import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { daemon, DnsRecord } from '../api/daemon';
import DnsRecordRow from '../components/DnsRecordRow';
import styles from './Dns.module.css';

export default function Dns() {
  const [searchParams] = useSearchParams();
  const initialName = searchParams.get('name') || '';
  
  const [names, setNames] = useState<string[]>([]);
  const [selectedName, setSelectedName] = useState(initialName);
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [isModified, setIsModified] = useState(false);

  useEffect(() => {
    daemon.getOwnedNames().then(res => {
      setNames(res);
      if (!selectedName && res.length > 0) {
        setSelectedName(res[0]);
      }
    }).catch(console.error);
  }, [selectedName]);

  useEffect(() => {
    if (!selectedName) return;
    daemon.getZone(selectedName).then(res => {
      // Flatten zone records
      const flat: DnsRecord[] = [];
      for (const [_, recs] of Object.entries(res.records)) {
        flat.push(...recs);
      }
      setRecords(flat);
      setIsModified(false);
    }).catch(console.error);
  }, [selectedName]);

  const updateRecordType = (idx: number, type: DnsRecord['type']) => {
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
    // Group records back into expected format
    const zoneData = { records: { '@': records } }; // Simplified for UI, typically root '@' or subdomains
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
          <span className="eyebrow">DNS MANAGEMENT</span>
          <h1 className={styles.title}>Zone Editor</h1>
        </div>
        
        <select 
          className={`input ${styles.selector}`}
          value={selectedName} 
          onChange={e => setSelectedName(e.target.value)}
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
              <DnsRecordRow 
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
              Save Zone
            </button>
            <button className="btn-primary" onClick={handlePublish} disabled={isModified}>
              Publish to Network
            </button>
          </div>
        </>
      )}
    </div>
  );
}
