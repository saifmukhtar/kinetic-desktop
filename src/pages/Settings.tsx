import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { daemon, HealthStatus } from '../api/daemon';
import StatusBadge from '../components/StatusBadge';
import ProxyModal from '../components/ProxyModal';
import AdvancedSettingsModal from '../components/AdvancedSettingsModal';
import AuthSessionsModal from '../components/AuthSessionsModal';
import styles from './Settings.module.css';

export default function Settings() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [apiUrl, setApiUrl] = useState<string>('Loading...');
  const [showProxyModal, setShowProxyModal] = useState(false);
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

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
            <h2 className={styles.sectionTitle}>Daemon Config (config.toml)</h2>
            <p className={styles.infoLabel} style={{ marginBottom: 0 }}>Directly modify the underlying daemon config.toml parameters.</p>
          </div>
          <button className="btn-ghost" onClick={() => setShowAdvancedModal(true)}>
            Edit config.toml
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className={styles.sectionTitle}>Identity & Security</h2>
            <p className={styles.infoLabel} style={{ marginBottom: 0 }}>View your Master Seed Phrase or restore a new identity.</p>
          </div>
          <button className="btn-ghost" onClick={() => navigate('/identity')}>
            Manage Identity
          </button>
        </div>
      </div>

      <div className="rule"></div>

      <div className={styles.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className={styles.sectionTitle}>Authorized Applications</h2>
            <p className={styles.infoLabel} style={{ marginBottom: 0 }}>Manage 3rd-party API sessions connected to your Daemon.</p>
          </div>
          <button className="btn-ghost" onClick={() => setShowAuthModal(true)}>
            Manage Sessions
          </button>
        </div>
      </div>

      <div className="rule"></div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle} style={{ color: 'var(--status-err)' }}>System Power</h2>
        <p className={styles.infoLabel} style={{ marginBottom: 'var(--sp-4)' }}>Control the background Kinetic daemon process.</p>
        
        <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
          <button 
            className="btn-ghost" 
            style={{ flex: 1, border: '1px solid var(--border-muted)', color: 'var(--ink-base)' }}
            onClick={async () => {
              if (confirm("Are you sure you want to restart the background daemon? This will interrupt active VDF tasks.")) {
                try {
                  await daemon.systemRestart();
                } catch (e: any) {
                  alert("Restart failed: " + e.toString());
                }
              }
            }}
          >
            🔄 Restart Daemon
          </button>
          <button 
            className="btn-ghost" 
            style={{ flex: 1, border: '1px solid var(--status-err)', color: 'var(--status-err)' }}
            onClick={async () => {
              if (confirm("Are you sure you want to shut down the daemon? The UI will become unresponsive until manually restarted.")) {
                try {
                  await daemon.systemShutdown();
                } catch (e: any) {
                  alert("Shutdown failed: " + e.toString());
                }
              }
            }}
          >
            🛑 Shutdown Daemon
          </button>
        </div>
      </div>

      {showProxyModal && <ProxyModal onClose={() => setShowProxyModal(false)} />}
      {showAdvancedModal && <AdvancedSettingsModal onClose={() => setShowAdvancedModal(false)} />}
      {showAuthModal && <AuthSessionsModal onClose={() => setShowAuthModal(false)} />}
    </div>
  );
}
