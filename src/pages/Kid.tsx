import { useState } from 'react';
import { daemon } from '../api/daemon';
import styles from './Kid.module.css';

export default function Kid() {
  const [resolveDid, setResolveDid] = useState('');
  const [resolveResult, setResolveResult] = useState<unknown>(null);
  
  const [publishPayload, setPublishPayload] = useState('{\n  "id": "did:kin:...",\n  "keys": []\n}');

  const handleResolve = async () => {
    if (!resolveDid) return;
    try {
      const res = await daemon.resolveKid(resolveDid);
      setResolveResult(res);
    } catch (err) {
      setResolveResult({ error: String(err) });
    }
  };

  const handlePublish = async () => {
    // In a real implementation this would call an API to publish the KID
    console.log("Publishing KID:", publishPayload);
    alert("Publishing KID payload (mock)");
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className="eyebrow">IDENTITY</span>
        <h1 className={styles.title}>KID Management</h1>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Resolve KID</h2>
        <div className={styles.inputGroup}>
          <input
            type="text"
            className={`input ${styles.inputField}`}
            placeholder="did:kin:..."
            value={resolveDid}
            onChange={e => setResolveDid(e.target.value)}
          />
          <button className="btn-ghost" onClick={handleResolve}>Resolve</button>
        </div>
        {resolveResult !== undefined && resolveResult !== null && (
          <pre className={styles.jsonViewer}>
            {JSON.stringify(resolveResult as Record<string, unknown>, null, 2)}
          </pre>
        )}
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Publish KID</h2>
        <textarea
          className={styles.jsonInput}
          value={publishPayload}
          onChange={e => setPublishPayload(e.target.value)}
        />
        <div>
          <button className="btn-primary" onClick={handlePublish}>Publish KID</button>
        </div>
      </div>
    </div>
  );
}
