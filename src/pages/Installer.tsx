import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { daemon } from '../api/daemon';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type PhaseId =
  | 'init'
  | 'dirs'
  | 'identity'
  | 'extract'
  | 'system'
  | 'pac'
  | 'done';

type PhaseStatus = 'pending' | 'running' | 'done' | 'error' | 'waiting';

interface Phase {
  id: PhaseId;
  label: string;
  sublabel: string;
  requiresRoot: boolean;
}

// ─────────────────────────────────────────────────────────────
// Phase definitions (in order of execution)
// ─────────────────────────────────────────────────────────────

const PHASES: Phase[] = [
  {
    id: 'dirs',
    label: 'Preparing workspace',
    sublabel: 'Creating your secure local directories',
    requiresRoot: false,
  },
  {
    id: 'identity',
    label: 'Checking identity',
    sublabel: 'Verifying cryptographic identity key',
    requiresRoot: false,
  },
  {
    id: 'extract',
    label: 'Staging engine files',
    sublabel: 'Unpacking bundled binaries to temp directory',
    requiresRoot: false,
  },
  {
    id: 'system',
    label: 'Installing system service',
    sublabel: 'Requires your administrator password — one time only',
    requiresRoot: true,
  },
  {
    id: 'pac',
    label: 'Starting network router',
    sublabel: 'Installing the local proxy auto-config service',
    requiresRoot: false,
  },
  {
    id: 'done',
    label: 'Ready',
    sublabel: 'Kinetic Engine is running',
    requiresRoot: false,
  },
];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function PhaseIcon({ status }: { status: PhaseStatus }) {
  if (status === 'done') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7.5" stroke="var(--amber)" strokeWidth="1"/>
        <path d="M5 8l2 2 4-4" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }
  if (status === 'error') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7.5" stroke="var(--status-err)" strokeWidth="1"/>
        <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="var(--status-err)" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    );
  }
  if (status === 'running') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" style={{ animation: 'spin 1s linear infinite' }}>
        <circle cx="8" cy="8" r="6.5" stroke="var(--border-strong)" strokeWidth="1.5" fill="none"/>
        <path d="M8 1.5A6.5 6.5 0 0 1 14.5 8" stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7.5" stroke="var(--border-strong)" strokeWidth="1"/>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export default function Installer() {
  const navigate = useNavigate();
  const [started, setStarted] = useState(false);
  const [statuses, setStatuses] = useState<Record<PhaseId, PhaseStatus>>({
    init: 'pending',
    dirs: 'pending',
    identity: 'pending',
    extract: 'pending',
    system: 'pending',
    pac: 'pending',
    done: 'pending',
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [needsIdentity, setNeedsIdentity] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  const pushLog = (msg: string) =>
    setLog((prev) => [...prev, msg]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  const setPhase = (id: PhaseId, status: PhaseStatus) => {
    setStatuses((prev) => ({ ...prev, [id]: status }));
  };

  // ── Orchestrator ──────────────────────────────────────────

  const runInstall = async () => {
    setStarted(true);
    setErrorMsg(null);
    setLog([]);

    try {
      // Step 1 — Create user-owned directories (no root)
      setPhase('dirs', 'running');
      pushLog('Creating local data directories…');
      await daemon.setupUserDirs();
      setPhase('dirs', 'done');
      pushLog('Directories ready.');

      // Step 2 — Check for identity key (no root)
      setPhase('identity', 'running');
      pushLog('Checking for existing identity key…');
      const hasKey = await daemon.checkIdentityKey();
      if (!hasKey) {
        setNeedsIdentity(true);
        setPhase('identity', 'waiting');
        pushLog('No identity key found — waiting for you to generate one…');
        return; // pause here, resume via continueAfterIdentity()
      }
      setPhase('identity', 'done');
      pushLog('Identity key found.');

      await continueFromExtract();
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      setErrorMsg(msg);
      toast.error('Installation failed: ' + msg);
      // mark current running phase as errored
      setStatuses((prev) => {
        const updated = { ...prev };
        (Object.keys(updated) as PhaseId[]).forEach((k) => {
          if (updated[k] === 'running') updated[k] = 'error';
        });
        return updated;
      });
    }
  };

  const continueAfterIdentity = async () => {
    setNeedsIdentity(false);
    setPhase('identity', 'done');
    pushLog('Identity key generated.');
    try {
      await continueFromExtract();
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      setErrorMsg(msg);
      toast.error('Installation failed: ' + msg);
    }
  };

  const continueFromExtract = async () => {
    // Step 3 — Extract bundled binaries (no root)
    setPhase('extract', 'running');
    pushLog('Staging engine binaries to temp directory…');
    await daemon.extractBundledBinaries();
    setPhase('extract', 'done');
    pushLog('Binaries staged.');

    // Step 4 — Install system service (ROOT — single popup)
    setPhase('system', 'running');
    pushLog('Requesting administrator privileges…');
    pushLog('Please enter your password in the system dialog.');
    await daemon.installSystem();
    setPhase('system', 'done');
    pushLog('System service installed and started.');

    // Step 5 — Install PAC router (no root)
    setPhase('pac', 'running');
    pushLog('Installing network proxy router…');
    await daemon.installPac();
    setPhase('pac', 'done');
    pushLog('Proxy router running.');

    // Done!
    setPhase('done', 'done');
    pushLog('Installation complete. Launching dashboard…');
    toast.success('Kinetic Engine is running.');
    setTimeout(() => navigate('/'), 1200);
  };

  // ─────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────

  const visiblePhases = PHASES.filter((p) => p.id !== 'done');
  const allDone = statuses['done'] === 'done';
  const hasError = errorMsg !== null;

  return (
    <div style={styles.root}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes progressFill { from { width: 0%; } to { width: 100%; } }
      `}</style>

      <div style={styles.card}>
        {/* ── Header ── */}
        <div style={styles.header}>
          <div style={styles.logoMark}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="var(--amber)"/>
              <path d="M8 20L14 8L20 20" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 16h8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h1 style={styles.title}>Install Kinetic Engine</h1>
            <p style={styles.subtitle}>Setting up the background system service</p>
          </div>
        </div>

        <div style={styles.divider} />

        {/* ── Phase list ── */}
        {started && (
          <div style={styles.phases}>
            {visiblePhases.map((phase, i) => {
              const status = statuses[phase.id];
              const isActive = status === 'running' || status === 'waiting';
              return (
                <div
                  key={phase.id}
                  style={{
                    ...styles.phaseRow,
                    ...(isActive ? styles.phaseRowActive : {}),
                    animation: `fadeIn ${100 + i * 60}ms var(--ease-out) both`,
                  }}
                >
                  <div style={styles.phaseIcon}>
                    <PhaseIcon status={status} />
                  </div>
                  <div style={styles.phaseText}>
                    <span style={{
                      ...styles.phaseLabel,
                      color: status === 'done'
                        ? 'var(--ink-secondary)'
                        : status === 'error'
                        ? 'var(--status-err)'
                        : isActive
                        ? 'var(--ink)'
                        : 'var(--ink-muted)',
                    }}>
                      {phase.label}
                    </span>
                    {isActive && (
                      <span style={styles.phaseSublabel}>{phase.sublabel}</span>
                    )}
                    {phase.requiresRoot && status === 'running' && (
                      <span style={styles.rootBadge}>Requires password</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Identity key prompt ── */}
        {needsIdentity && (
          <div style={styles.identityBox}>
            <p style={styles.identityText}>
              No identity key found. You need to generate a cryptographic key before the engine can join the network.
            </p>
            <div style={styles.identityActions}>
              <button
                style={styles.btnPrimary}
                onClick={async () => {
                  // Navigate to seed generation, then come back to continue
                  // For now we trigger continue directly after UI generates key
                  // The frontend seed flow should call continueAfterIdentity when done.
                  // As a temporary bridge, we navigate to seed then back.
                  navigate('/seed', { state: { returnTo: 'installer' } });
                }}
              >
                Generate Identity Key
              </button>
              <button
                style={styles.btnSecondary}
                onClick={continueAfterIdentity}
              >
                I already have one
              </button>
            </div>
          </div>
        )}

        {/* ── Log output ── */}
        {started && log.length > 0 && (
          <div style={styles.logBox} ref={logRef}>
            {log.map((line, i) => (
              <div key={i} style={styles.logLine}>
                <span style={styles.logPrefix}>›</span>
                {line}
              </div>
            ))}
          </div>
        )}

        {/* ── Error ── */}
        {hasError && (
          <div style={styles.errorBox}>
            <strong>Installation failed</strong>
            <p style={{ marginTop: 4, fontSize: 'var(--text-xs)', color: 'var(--status-err)' }}>
              {errorMsg}
            </p>
            <button
              style={{ ...styles.btnSecondary, marginTop: 12 }}
              onClick={() => {
                setStarted(false);
                setErrorMsg(null);
                setStatuses({
                  init: 'pending', dirs: 'pending', identity: 'pending',
                  extract: 'pending', system: 'pending', pac: 'pending', done: 'pending',
                });
                setLog([]);
                setNeedsIdentity(false);
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Primary action ── */}
        {!started && !allDone && (
          <div style={styles.footer}>
            <p style={styles.footerNote}>
              The engine runs as a system background service so it stays active even when this window is closed.
              A one-time administrator password prompt will appear during installation.
            </p>
            <button style={styles.btnPrimary} onClick={runInstall}>
              Install Engine
            </button>
          </div>
        )}

        {/* ── Done state ── */}
        {allDone && (
          <div style={styles.doneBox}>
            <div style={styles.doneIcon}>✓</div>
            <span style={{ fontWeight: 500, color: 'var(--status-ok)' }}>
              Engine running — launching dashboard…
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    width: '100%',
    background: 'var(--bg-base)',
    padding: '24px',
  },
  card: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    boxShadow: 'var(--shadow-lg)',
    width: '100%',
    maxWidth: '460px',
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    marginBottom: '20px',
  },
  logoMark: {
    flexShrink: 0,
  },
  title: {
    fontSize: 'var(--text-lg)',
    fontWeight: 600,
    color: 'var(--ink)',
    margin: 0,
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: 'var(--text-xs)',
    color: 'var(--ink-muted)',
    margin: '2px 0 0',
  },
  divider: {
    height: 1,
    background: 'var(--border)',
    marginBottom: '20px',
  },
  phases: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginBottom: '20px',
  },
  phaseRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '8px 10px',
    borderRadius: 'var(--r-md)',
    transition: 'background var(--dur-base) var(--ease-smooth)',
  },
  phaseRowActive: {
    background: 'var(--bg-subtle)',
  },
  phaseIcon: {
    marginTop: '1px',
    flexShrink: 0,
  },
  phaseText: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  phaseLabel: {
    fontSize: 'var(--text-sm)',
    fontWeight: 500,
    transition: 'color var(--dur-base)',
  },
  phaseSublabel: {
    fontSize: 'var(--text-xs)',
    color: 'var(--ink-muted)',
    animation: 'fadeIn 180ms var(--ease-out) both',
  },
  rootBadge: {
    display: 'inline-block',
    fontSize: 'var(--text-2xs)',
    fontWeight: 500,
    letterSpacing: '0.04em',
    padding: '1px 6px',
    borderRadius: 'var(--r-full)',
    background: 'var(--status-warn-soft)',
    color: 'var(--status-warn)',
    marginTop: '2px',
    animation: 'fadeIn 180ms var(--ease-out) both',
  },
  identityBox: {
    background: 'var(--status-pending-soft)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-md)',
    padding: '16px',
    marginBottom: '20px',
  },
  identityText: {
    fontSize: 'var(--text-sm)',
    color: 'var(--ink-secondary)',
    margin: '0 0 14px',
    lineHeight: 1.5,
  },
  identityActions: {
    display: 'flex',
    gap: '8px',
  },
  logBox: {
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-md)',
    padding: '12px 14px',
    maxHeight: '120px',
    overflowY: 'auto',
    marginBottom: '20px',
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-xs)',
    color: 'var(--ink-secondary)',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  logLine: {
    display: 'flex',
    gap: '8px',
    animation: 'fadeIn 120ms var(--ease-out) both',
  },
  logPrefix: {
    color: 'var(--amber)',
    flexShrink: 0,
  },
  errorBox: {
    background: 'var(--status-err-soft)',
    border: '1px solid var(--status-err)',
    borderRadius: 'var(--r-md)',
    padding: '14px 16px',
    fontSize: 'var(--text-sm)',
    color: 'var(--status-err)',
    marginBottom: '20px',
  },
  footer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  footerNote: {
    fontSize: 'var(--text-xs)',
    color: 'var(--ink-muted)',
    lineHeight: 1.6,
    margin: 0,
  },
  btnPrimary: {
    width: '100%',
    padding: '10px 16px',
    borderRadius: 'var(--r-md)',
    background: 'var(--amber)',
    color: '#fff',
    fontWeight: 500,
    fontSize: 'var(--text-sm)',
    border: 'none',
    cursor: 'pointer',
    transition: 'opacity var(--dur-fast)',
  },
  btnSecondary: {
    flex: 1,
    padding: '9px 14px',
    borderRadius: 'var(--r-md)',
    background: 'transparent',
    color: 'var(--ink-secondary)',
    fontWeight: 500,
    fontSize: 'var(--text-sm)',
    border: '1px solid var(--border-strong)',
    cursor: 'pointer',
    transition: 'background var(--dur-fast)',
  },
  doneBox: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '14px',
    borderRadius: 'var(--r-md)',
    background: 'var(--status-ok-soft)',
    animation: 'fadeIn 200ms var(--ease-out) both',
  },
  doneIcon: {
    fontSize: '18px',
    color: 'var(--status-ok)',
    fontWeight: 700,
  },
};
