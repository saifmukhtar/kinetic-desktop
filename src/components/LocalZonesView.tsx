import { useState, useEffect } from 'react';
import { daemon, NrsRecord, NrsZone } from '../api/daemon';
import NrsRecordRow from './NrsRecordRow';
import modalStyles from './ProxyModal.module.css'; // Reuse modal styles
import styles from './LocalZonesView.module.css';

interface ReservedName {
  name: string;
  active: boolean;
}

export default function LocalZonesView() {
  const [names, setNames] = useState<ReservedName[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState<string | null>(null);

  // Edit State
  const [records, setRecords] = useState<NrsRecord[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchNames = async () => {
    try {
      const res = await daemon.getReservedNames();
      setNames(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNames();
  }, []);

  const openEdit = async (name: string) => {
    setEditingName(name);
    setRecords([]);
    
    // Check if it's active. If it is, fetch the config.
    const item = names.find(n => n.name === name);
    if (item?.active) {
      try {
        const zone = await daemon.getLocalReservedZone(name);
        if (zone && zone.records && zone.records['@']) {
          setRecords(zone.records['@']);
        }
      } catch (err) {
        console.error("Failed to fetch zone", err);
      }
    }
  };

  const handleSave = async () => {
    if (!editingName) return;
    setSaving(true);
    try {
      // Package records back into the apex '@' array
      const zoneData: NrsZone = { records: { '@': records } };
      await daemon.saveLocalReservedZone(editingName, zoneData.records);
      await fetchNames();
      setEditingName(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingName) return;
    setSaving(true);
    try {
      await daemon.deleteLocalReservedZone(editingName);
      await fetchNames();
      setEditingName(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const updateRecordType = (idx: number, type: NrsRecord['type']) => {
    const newRecords = [...records];
    newRecords[idx] = { ...newRecords[idx], type };
    setRecords(newRecords);
  };

  const updateRecordValue = (idx: number, value: string) => {
    const newRecords = [...records];
    newRecords[idx] = { ...newRecords[idx], value };
    setRecords(newRecords);
  };

  const addRecord = () => {
    setRecords([...records, { type: 'A', value: '' }]);
  };

  const deleteRecord = (idx: number) => {
    const newRecords = [...records];
    newRecords.splice(idx, 1);
    setRecords(newRecords);
  };

  if (loading) return <p>Loading local zones...</p>;

  return (
    <div className={styles.container}>
      <p className={styles.description}>
        Reserved names can be routed locally. These records are completely private to your machine and are not published to the global DHT.
      </p>

      <div className={styles.grid}>
        {names.map(item => (
          <div 
            key={item.name} 
            className={`${styles.card} ${item.active ? styles.cardActive : styles.cardInactive}`}
            onClick={() => openEdit(item.name)}
          >
            <span className={`${styles.status} ${item.active ? styles.statusActive : styles.statusInactive}`}>
              {item.active ? 'Active' : 'Inactive'}
            </span>
            <span className={styles.name}>{item.name}.kin</span>
          </div>
        ))}
      </div>

      {editingName && (
        <div className={modalStyles.overlay} onClick={() => setEditingName(null)}>
          <div className={modalStyles.modal} onClick={e => e.stopPropagation()}>
            <div className={modalStyles.header}>
              <h2 className={modalStyles.title}>Configure {editingName}.kin</h2>
              <button className={modalStyles.closeBtn} onClick={() => setEditingName(null)}>✕</button>
            </div>

            <div className={modalStyles.content}>
              <div className={styles.modalRecords}>
                {records.length === 0 && <p className={styles.empty}>No records configured. Traffic will return NXDOMAIN.</p>}
                
                {records.map((rec, idx) => (
                  <NrsRecordRow 
                    key={idx}
                    record={rec}
                    onTypeChange={(type) => updateRecordType(idx, type)}
                    onValueChange={(value) => updateRecordValue(idx, value)}
                    onDelete={() => deleteRecord(idx)}
                  />
                ))}
              </div>

              <div>
                <button className="btn-ghost" onClick={addRecord}>
                  + Add Record
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                {names.find(n => n.name === editingName)?.active ? (
                  <button className="btn-ghost" onClick={handleDelete} disabled={saving} style={{ color: 'var(--status-err)' }}>
                    Disable Overlay
                  </button>
                ) : <div />}
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save & Enable'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
