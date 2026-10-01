import { useState, useEffect } from 'react';
import { daemon, HealthStatus } from '../api/daemon';
import StatusBadge from '../components/StatusBadge';
import ProxyModal from '../components/ProxyModal';
import AdvancedSettingsModal from '../components/AdvancedSettingsModal';
import styles from './Settings.module.css';

export default function Settings() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [apiUrl, setApiUrl] = useState<string>('Loading...');
  const [showProxyModal, setShowProxyModal] = useState(false);
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);

  useEffect(() => {
    daemon.getApiUrl().then(setApiUrl).catch(() => setApiUrl('Unavailable'));
    daemon.getHealth().then(setHealth).catch(console.error);
  }, []);

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className={styles.sectionTitle}>Advanced Daemon Configuration</h2>
            <p className={styles.infoLabel} style={{ marginBottom: 0 }}>Configure network ports, protocols, and low-level daemon settings.</p>
          </div>
          <button className="btn-ghost" onClick={() => setShowAdvancedModal(true)}>
            Advanced Settings
          </button>
        </div>
      </div>

      <div className="rule"></div>

      <div className={styles.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className={styles.sectionTitle}>OS Proxy & Routing</h2>
            <p className={styles.infoLabel} style={{ marginBottom: 0 }}>Configure universal PAC routing for Kinetic and custom namespaces.</p>
          </div>
          <button className="btn-ghost" onClick={() => setShowProxyModal(true)}>
            Manage Routing
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

      {showProxyModal && <ProxyModal onClose={() => setShowProxyModal(false)} />}
      {showAdvancedModal && <AdvancedSettingsModal onClose={() => setShowAdvancedModal(false)} />}
    </div>
  );
}
