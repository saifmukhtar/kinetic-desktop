import { useEffect, useState, useCallback } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useBinaryStatus } from "../context/BinaryStatus";
import { daemon, type HealthStatus, type NetworkStatus, type VdfTaskStatus } from "../api/daemon";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import { IconArrow, IconRefresh } from "../components/Icons";
import styles from "./Dashboard.module.css";

function formatUptime(seconds?: number): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

interface VdfEntry {
  taskId: string;
  name: string;
  status: VdfTaskStatus;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { status: binStatus } = useBinaryStatus();

  const [health, setHealth]       = useState<HealthStatus | null>(null);
  const [network, setNetwork]     = useState<NetworkStatus | null>(null);
  const [names, setNames]         = useState<string[]>([]);
  const [vdfTasks, setVdfTasks]   = useState<VdfEntry[]>([]);
  
  // New States
  const [identityStatus, setIdentityStatus] = useState<'found' | 'not_found' | 'corrupted' | 'loading'>('loading');
  const [pacRunning, setPacRunning] = useState<boolean>(false);
  const [natStatus, setNatStatus] = useState<string>('Unknown');
  const [heartbeats, setHeartbeats] = useState<Record<string, any>>({});
  
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [h, n, ns, id, pac, nat, hb] = await Promise.allSettled([
        daemon.getHealth(),
        daemon.getNetworkStatus(),
        daemon.getOwnedNames(),
        daemon.checkIdentityStatus(),
        daemon.checkPacStatus(),
        daemon.getNetworkNat(),
        daemon.getHeartbeats(),
      ]);
      if (h.status === "fulfilled") setHealth(h.value);
      if (n.status === "fulfilled") setNetwork(n.value);
      if (ns.status === "fulfilled") setNames(ns.value);
      if (id.status === "fulfilled") setIdentityStatus(id.value.status);
      if (pac.status === "fulfilled") setPacRunning(pac.value);
      if (nat.status === "fulfilled") setNatStatus(nat.value);
      if (hb.status === "fulfilled") setHeartbeats(hb.value);
      setError(null);
    } catch (e) {
      setError("Could not reach daemon.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const tasksObj = await daemon.getVdfTasks();
        const active: VdfEntry[] = Object.entries(tasksObj)
          .map(([taskId, status]) => ({ taskId, name: taskId, status }))
          .filter((e) => e.status.status !== "done" && e.status.status !== "error");
        setVdfTasks(active);
      } catch (err) {
        console.error("Failed to fetch VDF tasks:", err);
      }
    };

    fetchTasks();
    const int = setInterval(fetchTasks, 3000);
    return () => clearInterval(int);
  }, []);

  if (loading) {
    return (
      <div className={styles.loading}>
        <span className="eyebrow">Connecting to daemon…</span>
      </div>
    );
  }

  // Sort names by heartbeat idle time (highest first)
  const sortedNames = [...names].sort((a, b) => {
    const aIdle = heartbeats[a]?.kyns_idle || 0;
    const bIdle = heartbeats[b]?.kyns_idle || 0;
    return bIdle - aIdle;
  });

  return (
    <div className={styles.page}>
      {/* ── Page header ── */}
      <div className={styles.header}>
        <div>
          <p className="eyebrow">Overview</p>
          <h1 className={styles.title}>Dashboard</h1>
        </div>
        <button className="btn-ghost" onClick={load}>
          <IconRefresh size={13} />
          Refresh
        </button>
      </div>

      {/* ── Binary Status Badges ── */}
      {binStatus && (
        <div className={styles.binaryRow}>
          <div className={styles.binaryGroup}>
            <span className="eyebrow" style={{ marginRight: '8px' }}>Binaries:</span>
            <button 
              className={styles.binaryBadge} 
              data-status={binStatus.kin ? 'ok' : 'err'}
              onClick={() => !binStatus.kin && navigate('/installer')}
            >
              <span className={styles.binaryDot} /> kin
            </button>
            <button 
              className={styles.binaryBadge} 
              data-status={binStatus.kin_daemon ? 'ok' : 'err'}
              onClick={() => !binStatus.kin_daemon && navigate('/installer')}
            >
              <span className={styles.binaryDot} /> kin-daemon
            </button>
            <button 
              className={styles.binaryBadge} 
              data-status={binStatus.kin_pac ? 'ok' : 'err'}
              onClick={() => !binStatus.kin_pac && navigate('/installer')}
            >
              <span className={styles.binaryDot} /> kin-pac
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className={styles.errorBanner}>
          <StatusBadge status="offline" label="Daemon Offline" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Health Row ── */}
      <div className={styles.healthRow}>
        <div className={styles.healthPill}>
          <strong>Identity Key:</strong>
          {identityStatus === 'found' ? <StatusBadge status="published" label="Active" /> : 
           identityStatus === 'not_found' ? <StatusBadge status="offline" label="Missing" /> : 
           <StatusBadge status="error" label="Corrupted" />}
        </div>
        <div className={styles.healthPill}>
          <strong>PAC Router:</strong>
          {pacRunning ? <StatusBadge status="running" label="Online" /> : <StatusBadge status="error" label="Offline" />}
        </div>
        <div className={styles.healthPill}>
          <strong>NAT Status:</strong>
          <StatusBadge status={natStatus.toLowerCase().includes('direct') ? 'published' : 'pending'} label={natStatus || 'Unknown'} />
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className={styles.statGrid}>
        <StatCard
          eyebrow="Network Time"
          value={`Kyn ${network?.network_kyn ?? "—"}`}
          label="Current active epoch"
          accent
        />
        <StatCard
          eyebrow="Registered Names"
          value={names.length}
          label="names managed locally"
        />
        <StatCard
          eyebrow="Connected Peers"
          value={network?.peer_count ?? "—"}
          label={`mode: ${network?.mode ?? "unknown"}`}
        />
        <StatCard
          eyebrow="Daemon Uptime"
          value={formatUptime(health?.uptime_seconds)}
          label={`v${health?.version ?? "…"}`}
        />
      </div>

      {/* ── Lower panels ── */}
      <div className={styles.panels}>
        {/* Active VDF tasks */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className="eyebrow">Active Proofs</span>
          </div>
          {vdfTasks.length === 0 ? (
            <p className={styles.emptyState}>No active proof tasks</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Progress</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {vdfTasks.map((t) => (
                  <tr key={t.taskId}>
                    <td>
                      <span className={styles.mono}>{t.taskId.slice(0, 12)}…</span>
                    </td>
                    <td>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{ width: `${t.status.progress}%` }}
                        />
                      </div>
                      <span className={styles.progressLabel}>{t.status.progress}%</span>
                    </td>
                    <td>
                      <StatusBadge status="running" label={t.status.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Names at Risk / Recent names */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className="eyebrow">Owned Names</span>
            <NavLink to="/names" className="btn-arrow">
              Manage TTLs <IconArrow size={12} />
            </NavLink>
          </div>
          {sortedNames.length === 0 ? (
            <p className={styles.emptyState}>No names registered yet</p>
          ) : (
            <ul className={styles.nameList}>
              {sortedNames.slice(0, 6).map((name) => {
                const idle = heartbeats[name]?.kyns_idle || 0;
                const atRisk = idle > 7000;
                return (
                  <li key={name} className={styles.nameRow}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span className={`${styles.nameMono} ${atRisk ? styles.nameWarning : ''}`}>{name}</span>
                      <span style={{ fontSize: 'var(--text-2xs)', color: atRisk ? 'var(--status-warn)' : 'var(--ink-muted)' }}>
                        {atRisk ? `⚠️ TTL Risk: ${idle} idle Kyns` : `TTL: ${idle} idle Kyns`}
                      </span>
                    </div>
                    <NavLink
                      to={`/nrs?name=${encodeURIComponent(name)}`}
                      className="btn-arrow"
                    >
                      Manage <IconArrow size={11} />
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
