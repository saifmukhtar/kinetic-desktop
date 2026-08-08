import { useState, useEffect, useCallback } from 'react';
import { daemon, type LocalKidSummary, type KidDocument } from '../api/daemon';
import styles from './Kid.module.css';

export default function Kid() {
  const [kids, setKids] = useState<LocalKidSummary[]>([]);
  const [selectedName, setSelectedName] = useState<string>('');
  const [selectedDoc, setSelectedDoc] = useState<KidDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [docLoading, setDocLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subname generation state
  const [subName, setSubName] = useState('');

  const loadKids = useCallback(async () => {
    try {
      setError(null);
      const res = await daemon.getKids();
      const list = res.kids || [];
      setKids(list);
      if (list.length > 0) {
        setSelectedName(prev => (prev && list.some(k => k.name === prev) ? prev : list[0].name));
      } else {
        setSelectedName('');
        setSelectedDoc(null);
      }
    } catch (err) {
      console.error("Failed to load local KIDs:", err);
      setError("Failed to load local identity list.");
    }
  }, []);

  const loadSelectedDoc = useCallback(async (name: string) => {
    if (!name) {
      setSelectedDoc(null);
      return;
    }
    try {
      setDocLoading(true);
      const res = await daemon.getKid(name);
      setSelectedDoc(res.kid_doc || null);
    } catch (err) {
      console.error(`Failed to load document for ${name}:`, err);
    } finally {
      setDocLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKids();
  }, [loadKids]);

  useEffect(() => {
    if (selectedName) {
      loadSelectedDoc(selectedName);
    }
  }, [selectedName, loadSelectedDoc]);

  const handleRotate = async () => {
    if (!selectedName) return;
    try {
      setLoading(true);
      await daemon.rotateKid(selectedName);
      alert(`Successfully rotated keys for ${selectedName} and published update.`);
      await loadKids();
      await loadSelectedDoc(selectedName);
    } catch (err) {
      alert("Failed to rotate keys: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!selectedName) return;
    const confirmed = window.confirm(
      `Are you sure you want to permanently deactivate and revoke the identity for "${selectedName}"?\n\nThis action publishes a cryptographic revocation to the Kinetic network and cannot be undone.`
    );
    if (!confirmed) return;

    try {
      setLoading(true);
      await daemon.revokeKid(selectedName);
      alert(`Successfully revoked identity for ${selectedName}.`);
      await loadKids();
      await loadSelectedDoc(selectedName);
    } catch (err) {
      alert("Failed to revoke identity: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSubname = async () => {
    if (!selectedName || !subName.trim()) return;
    try {
      setLoading(true);
      const formattedSubName = subName.trim();
      await daemon.generateSubnameKid(selectedName, formattedSubName);
      alert(`Successfully generated KID for ${formattedSubName}.${selectedName}`);
      setSubName('');
      await loadKids();
    } catch (err) {
      alert("Failed to generate subname KID: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  const isDeactivated = Boolean(selectedDoc?.deactivated);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className="eyebrow">IDENTITY MANAGER</span>
        <h1 className={styles.title}>Kinetic Identity Documents</h1>
      </div>

      {error && (
        <div className="errorBanner mb-4">
          <span>{error}</span>
        </div>
      )}

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Select Identity</h2>
        {kids.length === 0 ? (
          <p className="text-secondary">No local KIDs found. Register a name first.</p>
        ) : (
          <select 
            className={`input ${styles.inputField}`}
            value={selectedName}
            onChange={e => setSelectedName(e.target.value)}
          >
            {kids.map(k => (
              <option key={k.name} value={k.name}>
                {k.name} {k.deactivated ? '(Deactivated)' : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {selectedName && (
        <>
          <div className={`${styles.section} ${styles.identityCard}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className={styles.sectionTitle}>Identity Card</h2>
              {isDeactivated && (
                <span className={styles.revokedBadge}>DEACTIVATED / REVOKED</span>
              )}
            </div>

            {docLoading ? (
              <p className="text-secondary">Loading identity document…</p>
            ) : selectedDoc ? (
              <div className={styles.cardDetails}>
                <div>
                  <strong>Name:</strong> <span>{selectedName}</span>
                </div>
                <div>
                  <strong>DID:</strong> <span className={styles.monoText}>{selectedDoc.kid}</span>
                </div>
                <div>
                  <strong>Status:</strong>{' '}
                  <span style={{ color: isDeactivated ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                    {isDeactivated ? 'Revoked (Deactivated)' : 'Active'}
                  </span>
                </div>
                <div>
                  <strong>Created:</strong>{' '}
                  <span>
                    {selectedDoc.created_at
                      ? new Date(selectedDoc.created_at * 1000).toLocaleString()
                      : '—'}
                  </span>
                </div>
                <div>
                  <strong>Active Controllers ({selectedDoc.controller_keys?.length || 0}/20):</strong>
                  <ul className={styles.keyRing}>
                    {selectedDoc.controller_keys?.map((ck, idx) => (
                      <li key={ck.id || idx}>
                        <span className={styles.keyType}>{ck.key_type || 'ML-DSA-65'}</span>: 
                        <span className={styles.monoText}>
                          {' '}
                          {ck.public_key ? `${ck.public_key.substring(0, 24)}...${ck.public_key.substring(ck.public_key.length - 8)}` : '—'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-secondary">No document found for {selectedName}.</p>
            )}
            
            <div className="mt-4">
              {isDeactivated ? (
                <p className="text-secondary" style={{ fontSize: '0.85rem' }}>
                  This identity has been permanently deactivated on the network. Key rotation is disabled.
                </p>
              ) : (
                <>
                  <div className={styles.actionGroup}>
                    <button 
                      className="btn-primary" 
                      onClick={handleRotate} 
                      disabled={loading || docLoading}
                    >
                      {loading ? 'Processing...' : 'Rotate Keys'}
                    </button>
                    <button 
                      className={styles.btnDanger} 
                      onClick={handleRevoke} 
                      disabled={loading || docLoading}
                    >
                      {loading ? 'Processing...' : 'Revoke Identity'}
                    </button>
                  </div>
                  <p className="text-secondary" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                    Rotate generates a new ML-DSA-65 keypair. Revoke permanently deactivates this identity across the network.
                  </p>
                </>
              )}
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Generate Subname KID</h2>
            {isDeactivated ? (
              <p className="text-secondary">Subname generation is unavailable for deactivated identities.</p>
            ) : (
              <>
                <div className={styles.inputGroup}>
                  <input
                    type="text"
                    className={`input ${styles.inputField}`}
                    placeholder="e.g. admin"
                    value={subName}
                    onChange={e => setSubName(e.target.value)}
                    disabled={loading || docLoading}
                  />
                  <span className={styles.suffixText}>.{selectedName}</span>
                </div>
                <div className="mt-4">
                  <button 
                    className="btn-ghost" 
                    onClick={handleGenerateSubname}
                    disabled={loading || !subName.trim() || docLoading}
                  >
                    {loading ? 'Generating...' : 'Generate Identity'}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}


