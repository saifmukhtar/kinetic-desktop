import { useState, useEffect } from 'react';
import { daemon, HealthStatus } from '../api/daemon';
import StatusBadge from '../components/StatusBadge';
import styles from './Settings.module.css';

export default function Settings() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [apiUrl, setApiUrl] = useState<string>('Loading...');
  const [currentMode, setCurrentMode] = useState<string>('full');
  const [selectedMode, setSelectedMode] = useState<string>('full');
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    daemon.getApiUrl().then(setApiUrl).catch(() => setApiUrl('Unavailable'));
    daemon.getHealth().then(setHealth).catch(console.error);
    daemon.getConfigInfo().then((info: any) => {
      if (info && info.mode) {
        setCurrentMode(info.mode);
        setSelectedMode(info.mode);
      }
    }).catch(console.error);
  }, []);

  const handleApply = async () => {
    setApplying(true);
    try {
      await daemon.updateConfig(selectedMode);
      setCurrentMode(selectedMode);
    } catch (err) {
      console.error(err);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className="eyebrow">PREFERENCES</span>
        <h1 className={styles.title}>Settings</h1>
      </div>

      <div className={styles.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className={styles.sectionTitle}>Daemon Connection</h2>
          <button className="btn-ghost" onClick={() => daemon.getHealth().then(setHealth).catch(console.error)}>
            Test Connection
          </button>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>API URL</span>
          <span className={styles.infoValue}>{apiUrl}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Status</span>
          <StatusBadge status={health?.status === 'ok' ? 'published' : 'error'} label={health?.status || 'Unknown'} />
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Uptime</span>
          <span className={styles.infoValue}>{health?.uptime_seconds ?? 0}s</span>
        </div>
      </div>

      <div className="rule"></div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Node Mode</h2>
        <div className={styles.radioGroup}>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              value="full"
              checked={selectedMode === 'full'}
              onChange={e => setSelectedMode(e.target.value)}
            />
            Full Node (participate in network and gossip)
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              value="light"
              checked={selectedMode === 'light'}
              onChange={e => setSelectedMode(e.target.value)}
            />
            Light Client (only sync block headers)
          </label>
        </div>
        <div className={styles.applyRow}>
          <button 
            className="btn-primary" 
            onClick={handleApply} 
            disabled={applying || selectedMode === currentMode}
          >
            {applying ? 'Applying...' : 'Apply'}
          </button>
        </div>
      </div>

      <div className="rule"></div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>About</h2>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>App Name</span>
          <span className={styles.infoValue}>Kinetic Desktop</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Daemon Version</span>
          <span className={styles.infoValue}>{health?.version || 'Unknown'}</span>
        </div>
      </div>
    </div>
  );
}
