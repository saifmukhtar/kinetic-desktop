import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { daemon, NrsRecord } from '../api/daemon';
import NrsRecordRow from '../components/NrsRecordRow';
import LocalZonesView from '../components/LocalZonesView';
import styles from './Nrs.module.css';

export default function Nrs() {
  const [searchParams] = useSearchParams();
  const initialName = searchParams.get('name') || '';
  
  const [names, setNames] = useState<string[]>([]);
  const [selectedName, setSelectedName] = useState(initialName);
  const [records, setRecords] = useState<NrsRecord[]>([]);
  const [isModified, setIsModified] = useState(false);

  // Tabs: 'global' | 'local'
  const [activeTab, setActiveTab] = useState<'global' | 'local'>('global');

  useEffect(() => {
    daemon.getOwnedNames().then(res => {
      setNames(res);
      if (!selectedName && res.length > 0) {
        setSelectedName(res[0]);
      }
    }).catch(console.error);
  }, [selectedName]);

  useEffect(() => {
    if (!selectedName || activeTab !== 'global') return;
    daemon.getZone(selectedName).then(res => {
      // Flatten zone records
      const flat: NrsRecord[] = [];
      for (const [_, recs] of Object.entries(res.records)) {
        flat.push(...recs);
      }
      setRecords(flat);
      setIsModified(false);
    }).catch(console.error);
  }, [selectedName, activeTab]);

  const updateRecordType = (idx: number, type: NrsRecord['type']) => {
    const newRecords = [...records];
    newRecords[idx] = { ...newRecords[idx], type };
    setRecords(newRecords);
    setIsModified(true);
  };

  const updateRecordValue = (idx: number, value: string) => {
    const newRecords = [...records];
    newRecords[idx] = { ...newRecords[idx], value };
    setRecords(newRecords);
    setIsModified(true);
  };

  const addRecord = () => {
    setRecords([...records, { type: 'TXT', value: '' }]);
    setIsModified(true);
  };

  const deleteRecord = (idx: number) => {
    const newRecords = [...records];
    newRecords.splice(idx, 1);
    setRecords(newRecords);
    setIsModified(true);
  };

  const handleSave = async () => {
    if (!selectedName) return;
    const zoneData = { records: { '@': records } }; // Simplified for UI
    try {
      await daemon.publishZone(selectedName, zoneData);
      setIsModified(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePublish = async () => {
    if (!selectedName) return;
    try {
      await daemon.signAndPublishZone(selectedName);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <span className="eyebrow">NRS MANAGEMENT</span>
          <h1 className={styles.title}>Record Editor</h1>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-muted)', padding: '4px', borderRadius: 'var(--r-sm)' }}>
          <button 
            className={`btn-ghost ${activeTab === 'global' ? styles.tabActive : ''}`} 
            onClick={() => setActiveTab('global')}
            style={activeTab === 'global' ? { background: 'var(--bg-surface)', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' } : {}}
          >
            Global Network
          </button>
          <button 
            className={`btn-ghost ${activeTab === 'local' ? styles.tabActive : ''}`} 
            onClick={() => setActiveTab('local')}
            style={activeTab === 'local' ? { background: 'var(--bg-surface)', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' } : {}}
          >
            Local Overrides
          </button>
        </div>
      </div>

      {activeTab === 'local' ? (
        <LocalZonesView />
      ) : (
        <>
          <div style={{ marginBottom: '24px' }}>
            <select 
              className={`input ${styles.selector}`}
              value={selectedName} 
              onChange={e => setSelectedName(e.target.value)}
              style={{ maxWidth: '300px' }}
            >
              <option value="">Select a name...</option>
              {names.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          {selectedName && (
            <>
              <div className={styles.records}>
                {records.length === 0 && <p className={styles.empty}>No records found.</p>}
                
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
                  Add Record
                </button>
              </div>

              <div className={styles.footer}>
                <button className="btn-ghost" onClick={handleSave} disabled={!isModified}>
                  Save Records
                </button>
                <button className="btn-primary" onClick={handlePublish} disabled={isModified}>
                  Publish to Network
                </button>
              </div>

              <div style={{ marginTop: 'var(--sp-6)', paddingTop: 'var(--sp-4)', borderTop: '1px solid var(--border-muted)' }}>
                <h3 style={{ color: 'var(--status-err)', fontSize: 'var(--text-base)', marginBottom: 'var(--sp-2)' }}>Transfer Ownership</h3>
                <p style={{ color: 'var(--ink-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--sp-4)' }}>
                  Permanently transfer this namespace to a new Identity Public Key. This action cannot be undone.
                </p>
                <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                  <input 
                    type="text" 
                    id="transferPubKey"
                    className="input input-mono" 
                    placeholder="New Pubkey (hex)..."
                    style={{ flex: 1 }}
                  />
                  <button 
                    className="btn-ghost"
                    style={{ border: '1px solid var(--status-err)', color: 'var(--status-err)' }}
                    onClick={async () => {
                      const pk = (document.getElementById('transferPubKey') as HTMLInputElement).value;
                      if (!pk) return alert("Enter a public key");
                      if (confirm(`Are you absolutely sure you want to transfer ${selectedName} to ${pk}?`)) {
                        try {
                          await daemon.postAuthorizedUpdate(selectedName, { new_pubkey: pk });
                          alert("Transfer initiated.");
                        } catch(e: any) {
                          alert("Transfer failed: " + e.toString());
                        }
                      }
                    }}
                  >
                    Transfer Name
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
