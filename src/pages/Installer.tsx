import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { daemon } from '../api/daemon';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────
// Types & Constants
// ─────────────────────────────────────────────────────────────

const STEPS = [
  { id: 0, label: 'Welcome' },
  { id: 1, label: 'Preparation' },
  { id: 2, label: 'Identity' },
  { id: 3, label: 'System Service' },
  { id: 4, label: 'Finalize' }
];

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export default function Installer() {
  const navigate = useNavigate();
  
  const [step, setStep] = useState<number>(() => {
    const saved = sessionStorage.getItem('installerStep');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const goToStep = (s: number) => {
    setStep(s);
    sessionStorage.setItem('installerStep', s.toString());
    setErrorMsg(null);
  };

  // ── Step 1: Preparation ──
  useEffect(() => {
    if (step === 1) {
      let isMounted = true;
      (async () => {
        try {
          await daemon.setupUserDirs();
          await daemon.extractBundledBinaries();
          const keyExists = await daemon.checkIdentityKey();
          if (isMounted) {
            setHasKey(keyExists);
            setTimeout(() => goToStep(2), 1000);
          }
        } catch (e: any) {
          if (isMounted) setErrorMsg(e?.message || String(e));
        }
      })();
      return () => { isMounted = false; };
    }
  }, [step]);

  // ── Step 2: Identity Check ──
  // If we arrive at step 2 (e.g. returning from /seed), re-check the key just in case.
  useEffect(() => {
    if (step === 2) {
      daemon.checkIdentityKey().then(setHasKey);
    }
  }, [step]);

  // ── Step 4: Finalize ──
  useEffect(() => {
    if (step === 4) {
      let isMounted = true;
      (async () => {
        try {
          await daemon.installPac();
          if (isMounted) {
            setTimeout(() => {
              sessionStorage.removeItem('installerStep');
              toast.success('Kinetic Engine installed successfully!');
              navigate('/');
            }, 1500);
          }
        } catch (e: any) {
          if (isMounted) setErrorMsg(e?.message || String(e));
        }
      })();
      return () => { isMounted = false; };
    }
  }, [step, navigate]);

  // ── Actions ──
  const handleSystemInstall = async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      await daemon.installSystem();
      goToStep(4);
    } catch (e: any) {
      setErrorMsg(e?.message || String(e));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateIdentity = () => {
    // We stay at step 2 in session storage, so when /seed comes back, it resumes here.
    navigate('/seed', { state: { returnTo: 'installer' } });
  };

  // ─────────────────────────────────────────────────────────
  // Renders
  // ─────────────────────────────────────────────────────────

  return (
    <div style={styles.root}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
      `}</style>

      <div style={styles.container}>
        {/* ── Sidebar ── */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <div style={styles.logoMark}>
              <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
                <rect width="28" height="28" rx="8" fill="var(--amber)"/>
                <path d="M8 20L14 8L20 20" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 16h8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <span style={styles.sidebarTitle}>Kinetic Setup</span>
          </div>

          <div style={styles.stepList}>
            {STEPS.map((s) => {
              const isActive = s.id === step;
              const isPast = s.id < step;
              return (
                <div key={s.id} style={{
                  ...styles.stepItem,
                  opacity: (isActive || isPast) ? 1 : 0.4,
                }}>
                  <div style={{
                    ...styles.stepIndicator,
                    background: isActive ? 'var(--amber)' : isPast ? 'var(--status-ok)' : 'transparent',
                    borderColor: isActive ? 'var(--amber)' : isPast ? 'var(--status-ok)' : 'var(--border-strong)',
                    color: (isActive || isPast) ? '#fff' : 'var(--ink-muted)',
                  }}>
                    {isPast ? '✓' : (s.id + 1)}
                  </div>
                  <span style={{
                    ...styles.stepLabel,
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'var(--ink)' : 'inherit',
                  }}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Main Content Area ── */}
        <div style={styles.content}>
          <div style={styles.contentInner}>
            
            {/* Step 0 */}
            {step === 0 && (
              <div style={styles.animBox}>
                <h1 style={styles.h1}>Welcome to Kinetic</h1>
                <p style={styles.p}>
                  The Kinetic Engine runs silently in the background to handle your peer-to-peer networking, global routing, and local DNS. Let's get it installed.
                </p>
                <button style={styles.btnPrimary} onClick={() => goToStep(1)}>
                  Begin Installation
                </button>
              </div>
            )}

            {/* Step 1 */}
            {step === 1 && (
              <div style={styles.animBox}>
                <h1 style={styles.h1}>Preparing Workspace</h1>
                <p style={styles.p}>Setting up secure local directories and staging system binaries...</p>
                {!errorMsg && <div style={styles.spinner} />}
              </div>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <div style={styles.animBox}>
                {hasKey ? (
                  <>
                    <div style={styles.successCircle}>✓</div>
                    <h1 style={styles.h1}>Identity Confirmed</h1>
                    <p style={styles.p}>
                      We found a cryptographic identity key securely stored on your system.
                    </p>
                    <div style={styles.greyBox}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                      </svg>
                      identity.key (Active)
                    </div>
                    <button style={styles.btnPrimary} onClick={() => goToStep(3)}>
                      Continue
                    </button>
                  </>
                ) : (
                  <>
                    <h1 style={styles.h1}>Network Identity</h1>
                    <p style={styles.p}>
                      To participate in the Kinetic network, you need a secure cryptographic identity. This acts as your private address.
                    </p>
                    <div style={styles.actionRow}>
                      <button style={styles.btnPrimary} onClick={handleGenerateIdentity}>
                        Generate Identity
                      </button>
                      <button style={styles.btnSecondary} onClick={handleGenerateIdentity}>
                        Import Existing
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <div style={styles.animBox}>
                <h1 style={styles.h1}>System Installation</h1>
                <p style={styles.p}>
                  The engine requires background system permissions to bind to local routing ports. 
                  Your operating system will now prompt you for your administrator password.
                </p>
                <div style={styles.warnBox}>
                  <strong style={{ display: 'block', marginBottom: '4px' }}>Security Note</strong>
                  This is a one-time setup. The engine will run securely in the background without needing prompts again.
                </div>
                <button 
                  style={{ ...styles.btnPrimary, opacity: isProcessing ? 0.7 : 1 }} 
                  onClick={handleSystemInstall}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Installing...' : 'Authorize & Install'}
                </button>
              </div>
            )}

            {/* Step 4 */}
            {step === 4 && (
              <div style={styles.animBox}>
                <h1 style={styles.h1}>Finalizing Setup</h1>
                <p style={styles.p}>Configuring the local proxy auto-router...</p>
                {!errorMsg && <div style={styles.spinner} />}
              </div>
            )}

            {/* Error State */}
            {errorMsg && (
              <div style={styles.errorBox}>
                <strong>Error</strong>
                <p style={{ margin: '4px 0 0' }}>{errorMsg}</p>
                <button 
                  style={{ ...styles.btnSecondary, marginTop: '12px', background: 'transparent' }} 
                  onClick={() => goToStep(step)}
                >
                  Retry Step
                </button>
              </div>
            )}

          </div>
        </div>
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
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    width: '100%',
    background: 'var(--bg-subtle)',
    padding: '24px',
  },
  container: {
    display: 'flex',
    width: '100%',
    maxWidth: '720px',
    height: '460px',
    background: 'var(--bg-base)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden',
  },
  sidebar: {
    width: '240px',
    background: 'var(--bg-elevated)',
    borderRight: '1px solid var(--border)',
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  sidebarHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '48px',
  },
  sidebarTitle: {
    fontSize: 'var(--text-base)',
    fontWeight: 600,
    color: 'var(--ink)',
  },
  logoMark: {
    display: 'flex',
  },
  stepList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  stepItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    transition: 'opacity var(--dur-base)',
  },
  stepIndicator: {
    width: '24px',
    height: '24px',
    borderRadius: '12px',
    border: '2px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 600,
    transition: 'all var(--dur-base)',
  },
  stepLabel: {
    fontSize: 'var(--text-sm)',
  },
  content: {
    flex: 1,
    padding: '48px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    position: 'relative',
  },
  contentInner: {
    maxWidth: '380px',
    margin: '0 auto',
    width: '100%',
  },
  animBox: {
    animation: 'fadeIn 300ms var(--ease-out) both',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  h1: {
    fontSize: 'var(--text-xl)',
    fontWeight: 600,
    color: 'var(--ink)',
    margin: 0,
    lineHeight: 1.2,
  },
  p: {
    fontSize: 'var(--text-sm)',
    color: 'var(--ink-secondary)',
    margin: 0,
    lineHeight: 1.6,
  },
  greyBox: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    background: 'var(--bg-subtle)',
    border: '1px solid var(--border)',
    padding: '10px 14px',
    borderRadius: 'var(--r-md)',
    color: 'var(--ink-secondary)',
    fontSize: 'var(--text-sm)',
    fontWeight: 500,
    marginTop: '4px',
    marginBottom: '8px',
  },
  successCircle: {
    width: '40px',
    height: '40px',
    borderRadius: '20px',
    background: 'var(--status-ok-soft)',
    color: 'var(--status-ok)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: 'bold',
    marginBottom: '8px',
  },
  warnBox: {
    background: 'var(--status-warn-soft)',
    border: '1px solid var(--status-warn)',
    borderRadius: 'var(--r-md)',
    padding: '12px 16px',
    fontSize: 'var(--text-sm)',
    color: 'var(--ink-secondary)',
    marginTop: '4px',
    marginBottom: '8px',
  },
  errorBox: {
    background: 'var(--status-err-soft)',
    border: '1px solid var(--status-err)',
    borderRadius: 'var(--r-md)',
    padding: '14px 16px',
    fontSize: 'var(--text-sm)',
    color: 'var(--status-err)',
    marginTop: '24px',
    animation: 'fadeIn 200ms var(--ease-out)',
  },
  actionRow: {
    display: 'flex',
    gap: '12px',
    marginTop: '8px',
  },
  btnPrimary: {
    padding: '10px 18px',
    borderRadius: 'var(--r-md)',
    background: 'var(--amber)',
    color: '#fff',
    fontWeight: 500,
    fontSize: 'var(--text-sm)',
    border: 'none',
    cursor: 'pointer',
    transition: 'opacity var(--dur-fast)',
    alignSelf: 'flex-start',
  },
  btnSecondary: {
    padding: '9px 18px',
    borderRadius: 'var(--r-md)',
    background: 'transparent',
    color: 'var(--ink)',
    fontWeight: 500,
    fontSize: 'var(--text-sm)',
    border: '1px solid var(--border-strong)',
    cursor: 'pointer',
    transition: 'background var(--dur-fast)',
    alignSelf: 'flex-start',
  },
  spinner: {
    width: '24px',
    height: '24px',
    border: '2px solid var(--border-strong)',
    borderTopColor: 'var(--amber)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginTop: '8px',
  }
};
