import { useState, useEffect } from 'react';
import { daemon, KineticTime, AtlasNetwork } from '../api/daemon';
import styles from './Forge.module.css';

export default function Forge() {
  const [time, setTime] = useState<KineticTime | null>(null);
  const [networks, setNetworks] = useState<AtlasNetwork[]>([]);
  const [resolveName, setResolveName] = useState('');
  const [resolveResult, setResolveResult] = useState<unknown>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    daemon.getTime().then(setTime).catch(console.error);
    daemon.getAtlasNetworks().then(setNetworks).catch(console.error);
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await daemon.syncAtlas();
      const updated = await daemon.getAtlasNetworks();
      setNetworks(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  const handleResolve = async () => {
    if (!resolveName) return;
    try {
      const res = await daemon.resolveName(resolveName);
      setResolveResult(res);
    } catch (err) {
      setResolveResult({ error: String(err) });
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className="eyebrow">FORGE</span>
        <h1 className={styles.title}>Kinetic Forge</h1>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Kinetic Time</div>
          <div className={styles.timeDisplay}>Pulse {time?.drand_pulse || '---'}</div>
          <div className={styles.timeSub}>Timestamp: {time?.timestamp || '---'}</div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>
            Atlas Networks
            <button className="btn-ghost" onClick={handleSync} disabled={syncing}>
              {syncing ? 'Syncing...' : 'Sync Atlas'}
            </button>
          </div>
          <div className={styles.list}>
            {networks.length === 0 ? (
              <div style={{ color: 'var(--ink-muted)', fontStyle: 'italic' }}>No networks loaded.</div>
            ) : (
              networks.map((net, i) => (
                <div key={i} className={styles.listItem}>
                  {net.name} ({net.tld})
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Resolve Name</div>
        <div className={styles.inputGroup}>
          <input
            type="text"
            className={`input ${styles.inputField}`}
            placeholder="e.g. hello.kin"
            value={resolveName}
            onChange={e => setResolveName(e.target.value)}
          />
          <button className="btn-ghost" onClick={handleResolve}>Resolve</button>
        </div>
        <div className={styles.resultBox}>
          {resolveResult ? JSON.stringify(resolveResult, null, 2) : 'Awaiting query...'}
        </div>
      </div>
    </div>
  );
}
