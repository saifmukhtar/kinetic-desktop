import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { daemon } from '../api/daemon';
import StatusBadge from '../components/StatusBadge';
import { IconArrow } from '../components/Icons';
import RegisterNameModal from '../components/RegisterNameModal';
import styles from './Names.module.css';

export default function Names() {
  const navigate = useNavigate();
  const [names, setNames] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    loadNames();
  }, []);

  async function loadNames() {
    try {
      const owned = await daemon.getOwnedNames();
      setNames(owned);
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
          <p className={styles.empty}>No names registered yet.</p>
        ) : filteredNames.length === 0 ? (
          <p className={styles.empty}>No matches found.</p>
        ) : (
          filteredNames.map(name => (
            <div key={name} className={styles.row}>
              <div className={styles.nameGroup}>
                <span className={styles.name}>{name}</span>
                <StatusBadge status="published" />
              </div>
              <div className={styles.timestamp} style={{ color: 'var(--ink-muted)', fontSize: 'var(--text-sm)', flex: 1, textAlign: 'center' }}>
                {new Date().toLocaleDateString()}
              </div>
              <div className={styles.actions}>
                <button
                  className="btn-arrow"
                  onClick={() => navigate(`/nrs?name=${encodeURIComponent(name)}`)}
                >
                  Edit NRS <IconArrow />
                </button>
                <button className="btn-ghost">Renew</button>
              </div>
            </div>
          ))
        )}
      </div>

      {panelOpen && (
        <RegisterNameModal
          onClose={() => setPanelOpen(false)}
          onSuccess={loadNames}
        />
      )}
    </div>
  );
}
