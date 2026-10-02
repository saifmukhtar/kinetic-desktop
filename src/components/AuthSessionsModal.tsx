import { useState, useEffect } from 'react';
import { daemon } from '../api/daemon';
import styles from './AuthSessionsModal.module.css';

interface Props {
  onClose: () => void;
}

export default function AuthSessionsModal({ onClose }: Props) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // New session state
  const [appName, setAppName] = useState('');
  const [expiryDays, setExpiryDays] = useState(30);
  const [newToken, setNewToken] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    setLoading(true);
    try {
      const data = await daemon.getAuthSessions();
      // Ensure we have an array
      setSessions(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }

  const handleCreate = async () => {
    if (!appName) return alert("Please enter an application name.");
    try {
      // 1 day = approx 86400 seconds. If a Kyn is 10s, 1 day = 8640 Kyns.
      // We pass it to the backend as requested
      const kyns = expiryDays * 8640; 
      const res = await daemon.createSession(appName, ["*"], kyns);
      if (res && res.token) {
        setNewToken(res.token);
      } else {
        setNewToken(JSON.stringify(res)); // fallback
      }
      setAppName('');
      loadSessions();
    } catch (e: any) {
      alert("Failed to create session: " + e.toString());
    }
  };

  const handleRevoke = async (id: string) => {
    if (confirm("Revoke this session immediately?")) {
      try {
        await daemon.revokeAuthSession(id);
        loadSessions();
      } catch (e: any) {
        alert("Failed to revoke session: " + e.toString());
      }
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>API Sessions</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.content}>
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Generate New Token</h3>
            <span className={styles.desc}>Create an API token to allow 3rd-party local apps to connect to your Daemon.</span>
            
            {newToken && (
              <div className={styles.tokenBox}>
                <strong>⚠️ Copy this token now. It will not be shown again.</strong>
                <div className={styles.tokenText}>{newToken}</div>
                <button className="btn-ghost" style={{ marginTop: 'var(--sp-2)' }} onClick={() => setNewToken(null)}>Clear</button>
              </div>
            )}

            <div className={styles.fieldRow}>
              <input 
                type="text" 
                className={styles.input} 
                placeholder="App Name (e.g. Browser Extension)" 
                value={appName}
                onChange={e => setAppName(e.target.value)}
              />
              <select className={styles.input} style={{ width: '120px' }} value={expiryDays} onChange={e => setExpiryDays(parseInt(e.target.value))}>
                <option value={7}>7 Days</option>
                <option value={30}>30 Days</option>
                <option value={90}>90 Days</option>
              </select>
              <button className="btn-primary" onClick={handleCreate}>Generate</button>
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Active Sessions</h3>
            {loading ? (
              <div className={styles.empty}>Loading...</div>
            ) : sessions.length === 0 ? (
              <div className={styles.empty}>No active API sessions.</div>
            ) : (
              sessions.map((s, i) => (
                <div key={s.id || i} className={styles.sessionCard}>
                  <div className={styles.sessionInfo}>
                    <span className={styles.sessionName}>{s.app_name || 'Unnamed App'}</span>
                    <span className={styles.sessionMeta}>ID: {s.id}</span>
                    <span className={styles.sessionMeta}>Scopes: {(s.scopes || []).join(', ') || 'All'}</span>
                  </div>
                  <button 
                    className="btn-ghost" 
                    style={{ border: '1px solid var(--status-err)', color: 'var(--status-err)', padding: 'var(--sp-1) var(--sp-2)' }}
                    onClick={() => handleRevoke(s.id)}
                  >
                    Revoke
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
