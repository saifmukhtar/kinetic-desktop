import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { daemon } from '../api/daemon';
import styles from './AuthSessionsModal.module.css';

interface Props {
  onClose: () => void;
}

export default function AuthSessionsModal({ onClose }: Props) {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [appName, setAppName] = useState('');
  const [expiryDays, setExpiryDays] = useState(30);
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['Metric']);
  const [newToken, setNewToken] = useState<string | null>(null);

  const AVAILABLE_SCOPES = [
    'Kid', 'Nrs', 'Vdf', 'Action', 'Gossip', 'Metric', 'System', 'Atlas', 'Heartbeat'
  ];

  const toggleScope = (scope: string) => {
    setSelectedScopes(prev => 
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    );
  };

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    setLoading(true);
    try {
      const data = await daemon.getAuthSessions();
      // Ensure we have an array
      setSessions(Array.isArray((data as any).sessions) ? (data as any).sessions : Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }

  const handleCreate = async () => {
    if (!appName) return alert("Please enter an application name.");
    if (selectedScopes.length === 0) return alert("Please select at least one scope.");
    if (!expiryDays || expiryDays <= 0) return alert("Please enter a valid number of days for expiration.");
    
    try {
      // 1 day = approx 86400 seconds. If a Kyn is 10s, 1 day = 8640 Kyns.
      const kyns = expiryDays * 8640; 
      const res = await daemon.createSession(appName, selectedScopes, kyns);
      if (res && res.token) {
        setNewToken(res.token);
      } else {
        setNewToken(JSON.stringify(res)); // fallback
      }
      setAppName('');
      setSelectedScopes(['Metric']);
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

  return createPortal(
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

            <div className={styles.fieldRow} style={{ flexWrap: 'wrap' }}>
              <input 
                type="text" 
                className={styles.input} 
                style={{ flex: '1 1 200px' }}
                placeholder="App Name (e.g. Browser Extension)" 
                value={appName}
                onChange={e => setAppName(e.target.value)}
              />
              <div style={{ flex: '0 0 120px', display: 'flex', alignItems: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border-muted)', borderRadius: 'var(--r-sm)', padding: '0 var(--sp-2)' }}>
                <input 
                  type="number" 
                  className={styles.input}
                  style={{ border: 'none', background: 'transparent', padding: 'var(--sp-2) 0', width: '100%', outline: 'none' }}
                  placeholder="Days" 
                  min="1"
                  value={expiryDays || ''}
                  onChange={e => setExpiryDays(parseInt(e.target.value) || 0)}
                />
                <span style={{ color: 'var(--ink-muted)', fontSize: 'var(--text-sm)', paddingLeft: '4px' }}>Days</span>
              </div>
              <button className="btn-primary" style={{ flex: '0 0 auto' }} onClick={handleCreate}>Generate</button>
            </div>
            
            <div style={{ marginTop: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
              <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-base)' }}>Permissions (Scopes):</strong>
              <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-2)', flexWrap: 'wrap' }}>
                {AVAILABLE_SCOPES.map(scope => (
                  <label key={scope} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-sm)', color: 'var(--ink-muted)' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedScopes.includes(scope)} 
                      onChange={() => toggleScope(scope)}
                    />
                    {scope}
                  </label>
                ))}
              </div>
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
,
    document.body
  );
}
