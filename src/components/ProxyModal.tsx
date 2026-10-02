import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { daemon } from '../api/daemon';
import styles from './ProxyModal.module.css';

interface ProxyModalProps {
  onClose: () => void;
}

export default function ProxyModal({ onClose }: ProxyModalProps) {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pacActive, setPacActive] = useState<boolean | null>(null);

  // Add Form State
  const [nsp, setNsp] = useState('');
  const [ip, setIp] = useState('');
  const [port, setPort] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchRules();
    checkPacStatus();
  }, []);

  async function checkPacStatus() {
    try {
      // kinetic-pac serves on port 16001 — check if it responds
      const res = await daemon.checkPacStatus();
      setPacActive(res);
    } catch {
      setPacActive(false);
    }
  }

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
      if (!nsp.trim()) throw new Error('Namespace is required');

      const ipVal = ip.trim();
      if (!ipVal) throw new Error('Target IP is required');
      const ipv4Re = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipv4Re.test(ipVal)) throw new Error('Target IP must be a valid IPv4 address (e.g. 127.0.255.2)');
      const octets = ipVal.split('.').map(Number);
      if (octets.some(o => o < 0 || o > 255)) throw new Error('Each IP octet must be between 0 and 255');

      const p = parseInt(port, 10);
      if (isNaN(p) || p < 1 || p > 65535) throw new Error('Port must be a number between 1 and 65535');

      await daemon.addCustomProxy(nsp.trim(), ipVal, p);
      await fetchRules();
      setNsp('');
      setPort('');
      setIp('');
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

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>OS Proxy & Routing</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.content}>
          <div className={styles.switchSection} style={{ borderBottom: 'none' }}>
            <div className={styles.switchInfo}>
              <span className={styles.switchTitle}>Universal PAC Server</span>
              <span className={styles.switchDesc}>Automatically route registered namespaces seamlessly across your OS.</span>
            </div>
            {/* Real PAC status — checks if kinetic-pac is serving on 16001 */}
            {pacActive === null && (
              <span style={{ color: 'var(--ink-muted)', fontWeight: 500, fontSize: 'var(--text-sm)' }}>Checking...</span>
            )}
            {pacActive === true && (
              <span style={{ color: 'var(--status-ok)', fontWeight: 500, fontSize: 'var(--text-sm)' }}>● Active</span>
            )}
            {pacActive === false && (
              <span style={{ color: 'var(--status-err)', fontWeight: 500, fontSize: 'var(--text-sm)' }}>● Offline</span>
            )}
          </div>

          <div className={styles.switchSection}>
            <div className={styles.switchInfo}>
              <span className={styles.switchTitle}>Root CA Certificate</span>
              <span className={styles.switchDesc}>Install this to your OS or Browser trust store to prevent SSL warnings when visiting encrypted local domains.</span>
            </div>
            <button 
              className="btn-ghost" 
              onClick={async () => {
                try {
                  const cert = await daemon.getCaCert();
                  const blob = new Blob([cert], { type: 'application/x-pem-file' });
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'kinetic_proxy_ca.crt';
                  a.click();
                  window.URL.revokeObjectURL(url);
                } catch (e: any) {
                  setErrorMsg('Failed to download CA certificate: ' + e.toString());
                }
              }}
            >
              Download .crt
            </button>
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
                      <button
                        onClick={() => handleDelete(rule.filename)}
                        style={{
                          background: 'none',
                          border: '1px solid var(--status-err)',
                          color: 'var(--status-err)',
                          cursor: 'pointer',
                          fontSize: 'var(--text-xs)',
                          padding: '3px 10px',
                          borderRadius: 'var(--r-sm)',
                          fontWeight: 500,
                        }}
                        onMouseOver={e => (e.currentTarget.style.background = 'rgba(220,38,38,0.08)')}
                        onMouseOut={e => (e.currentTarget.style.background = 'none')}
                      >
                        Remove
                      </button>
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
,
    document.body
  );
}
