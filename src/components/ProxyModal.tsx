import { useState, useEffect } from 'react';
import { daemon } from '../api/daemon';
import styles from './ProxyModal.module.css';

interface ProxyModalProps {
  onClose: () => void;
}

export default function ProxyModal({ onClose }: ProxyModalProps) {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Add Form State
  const [nsp, setNsp] = useState('');
  const [ip, setIp] = useState('127.0.0.1');
  const [port, setPort] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchRules();
  }, []);

  async function fetchRules() {
    try {
      const res = await daemon.listProxyRules();
      setRules(res);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.toString());
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setAdding(true);
    try {
      const p = parseInt(port, 10);
      if (isNaN(p)) throw new Error('Port must be a valid number');
      if (!nsp) throw new Error('Namespace is required');
      
      await daemon.addCustomProxy(nsp, ip || '127.0.0.1', p);
      await fetchRules();
      setNsp('');
      setPort('');
      setIp('127.0.0.1');
    } catch (err: any) {
      setErrorMsg(err.toString());
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(filename: string) {
    try {
      await daemon.removeCustomProxy(filename);
      await fetchRules();
    } catch (err: any) {
      setErrorMsg(err.toString());
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>OS Proxy & Routing</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.content}>
          <div className={styles.switchSection}>
            <div className={styles.switchInfo}>
              <span className={styles.switchTitle}>Universal PAC Server</span>
              <span className={styles.switchDesc}>Automatically route registered namespaces seamlessly across your OS.</span>
            </div>
            {/* Mocking the status as Active for now since kinetic-pac is a standalone service */}
            <span style={{ color: 'var(--status-ok)', fontWeight: 500, fontSize: 'var(--text-sm)' }}>Active</span>
          </div>

          <div>
            <h3 className={styles.sectionTitle}>Active Routes</h3>
            {loading ? (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-muted)' }}>Loading rules...</p>
            ) : rules.length === 0 ? (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-muted)' }}>No routes configured.</p>
            ) : (
              <div className={styles.ruleList}>
                {rules.map(rule => (
                  <div key={rule.filename} className={styles.ruleItem}>
                    <div className={styles.ruleLeft}>
                      <span className={styles.ruleNsp}>.{rule.nsp}</span>
                      <span className={styles.ruleTarget}>{rule.proxy_ip}:{rule.proxy_port}</span>
                    </div>
                    {rule.is_custom && (
                      <button className={styles.deleteBtn} onClick={() => handleDelete(rule.filename)}>Remove</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className={styles.sectionTitle}>Add Custom Route</h3>
            <form className={styles.addForm} onSubmit={handleAdd}>
              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Namespace (e.g. kin)</label>
                  <input type="text" className="input" value={nsp} onChange={e => setNsp(e.target.value)} placeholder="kin" required />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Target IP</label>
                  <input type="text" className="input" value={ip} onChange={e => setIp(e.target.value)} placeholder="127.0.255.2" required />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Target Port</label>
                  <input type="text" className="input" value={port} onChange={e => setPort(e.target.value)} placeholder="8080" required />
                </div>
              </div>
              <button type="submit" className="btn-ghost" disabled={adding}>
                {adding ? 'Adding...' : 'Add Custom Route'}
              </button>
            </form>
          </div>

          {errorMsg && <p className={styles.error}>{errorMsg}</p>}
        </div>
      </div>
    </div>
  );
}
