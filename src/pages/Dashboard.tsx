import { useEffect, useState, useCallback } from "react";
import { NavLink } from "react-router-dom";
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
  const [health, setHealth]       = useState<HealthStatus | null>(null);
  const [network, setNetwork]     = useState<NetworkStatus | null>(null);
  const [names, setNames]         = useState<string[]>([]);
  const [vdfTasks, setVdfTasks]   = useState<VdfEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [h, n, ns] = await Promise.allSettled([
        daemon.getHealth(),
        daemon.getNetworkStatus(),
        daemon.getOwnedNames(),
      ]);
      if (h.status === "fulfilled") setHealth(h.value);
      if (n.status === "fulfilled") setNetwork(n.value);
      if (ns.status === "fulfilled") setNames(ns.value);
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

      {error && (
        <div className={styles.errorBanner}>
          <StatusBadge status="offline" label="Daemon Offline" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className={styles.statGrid}>
        <StatCard
          eyebrow="Registered Names"
          value={names.length}
          label="names managed by this identity"
          accent
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

        {/* Recent names */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className="eyebrow">Registered Names</span>
            <NavLink to="/names" className="btn-arrow">
              All names <IconArrow size={12} />
            </NavLink>
          </div>
          {names.length === 0 ? (
            <p className={styles.emptyState}>No names registered yet</p>
          ) : (
            <ul className={styles.nameList}>
              {names.slice(0, 6).map((name) => (
                <li key={name} className={styles.nameRow}>
                  <span className={styles.nameMono}>{name}</span>
                  <NavLink
                    to={`/nrs?name=${encodeURIComponent(name)}`}
                    className="btn-arrow"
                  >
                    Manage <IconArrow size={11} />
                  </NavLink>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
