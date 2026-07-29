import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { daemon } from '../api/daemon';
import StatusBadge from '../components/StatusBadge';
import { IconArrow } from '../components/Icons';
import styles from './Names.module.css';

export default function Names() {
  const navigate = useNavigate();
  const [names, setNames] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const [registerName, setRegisterName] = useState('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    loadNames();
  }, []);

  useEffect(() => {
    if (!taskId) return;
    const interval = setInterval(async () => {
      try {
        const status = await daemon.getVdfStatus(taskId);
        setProgress(status.progress);
        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(interval);
          setTaskId(null);
          loadNames();
          if (status.status === 'completed') setPanelOpen(false);
        }
      } catch (err) {
        console.error(err);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [taskId]);

  async function loadNames() {
    try {
      const owned = await daemon.getOwnedNames();
      setNames(owned);
    } catch (err) {
      console.error(err);
    }
  }

  async function startRegistration() {
    if (!registerName) return;
    try {
      const res = await daemon.registerVdf({ name: registerName });
      setTaskId(res.task_id);
      setProgress(0);
    } catch (err) {
      console.error(err);
    }
  }

  const filteredNames = names.filter(n => n.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <span className="eyebrow">REGISTERED NAMES</span>
          <h1 className={styles.title}>Names</h1>
        </div>
        <button className="btn-primary" onClick={() => setPanelOpen(true)}>
          Register New Name
        </button>
      </div>

      <input
        type="text"
        className={`input ${styles.search}`}
        placeholder="Search names..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div className={styles.list}>
        {names.length === 0 ? (
          <p className={styles.empty}>No names owned yet.</p>
        ) : filteredNames.length === 0 ? (
          <p className={styles.empty}>No matches found.</p>
        ) : (
          filteredNames.map(name => (
            <div key={name} className={styles.row}>
              <div className={styles.nameGroup}>
                <span className={styles.name}>{name}</span>
                <StatusBadge status="published" />
              </div>
              <div className={styles.actions}>
                <button
                  className="btn-arrow"
                  onClick={() => navigate(`/dns?name=${encodeURIComponent(name)}`)}
                >
                  Edit DNS <IconArrow />
                </button>
                <button className="btn-ghost">Renew</button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className={`${styles.overlay} ${panelOpen ? styles.open : ''}`} onClick={() => !taskId && setPanelOpen(false)} />
      
      <div className={`${styles.panel} ${panelOpen ? styles.open : ''}`}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Register Name</h2>
          {!taskId && (
            <button className={styles.closeBtn} onClick={() => setPanelOpen(false)}>&times;</button>
          )}
        </div>
        
        <input
          type="text"
          className="input input-mono"
          placeholder="e.g. alice.kin"
          value={registerName}
          onChange={e => setRegisterName(e.target.value)}
          disabled={!!taskId}
        />
        
        {taskId ? (
          <div className={styles.progressContainer}>
            <span>Calculating VDF proof... {Math.round(progress * 100)}%</span>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
        ) : (
          <button className="btn-primary" onClick={startRegistration} disabled={!registerName}>
            Start Registration
          </button>
        )}
      </div>
    </div>
  );
}
