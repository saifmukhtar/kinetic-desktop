import { useState, useEffect, useCallback } from 'react';
import { daemon, type LocalKidSummary, type KidDocument, type CapabilityManifest, type ServiceEntry } from '../api/daemon';
import styles from './Kid.module.css';

export default function Kid() {
  const [kids, setKids] = useState<LocalKidSummary[]>([]);
  const [selectedName, setSelectedName] = useState<string>('');
  const [selectedDoc, setSelectedDoc] = useState<KidDocument | null>(null);
  const [manifest, setManifest] = useState<CapabilityManifest | null>(null);
  const [services, setServices] = useState<ServiceEntry[]>([]);

  // Loading & error states
  const [loading, setLoading] = useState(false);
  const [docLoading, setDocLoading] = useState(false);
  const [manifestLoading, setManifestLoading] = useState(false);
  const [manifestSaving, setManifestSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manifestSuccess, setManifestSuccess] = useState<string | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);

  // Subname generation state
  const [subName, setSubName] = useState('');

  // Add Service Form state
  const [srvId, setSrvId] = useState('');
  const [srvType, setSrvType] = useState('website');
  const [srvProtocol, setSrvProtocol] = useState('https');
  const [srvEndpoint, setSrvEndpoint] = useState('');

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
        setManifest(null);
        setServices([]);
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

  const loadManifest = useCallback(async (name: string) => {
    if (!name) {
      setManifest(null);
      setServices([]);
      return;
    }
    try {
      setManifestLoading(true);
      setManifestError(null);
      setManifestSuccess(null);
      const res = await daemon.getKidManifest(name);
      if (res.manifest) {
        setManifest(res.manifest);
        setServices(res.manifest.services || []);
      } else {
        setManifest(null);
        setServices([]);
      }
    } catch (err) {
      console.error(`Failed to load manifest for ${name}:`, err);
      setManifest(null);
      setServices([]);
    } finally {
      setManifestLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKids();
  }, [loadKids]);

  useEffect(() => {
    if (selectedName) {
      loadSelectedDoc(selectedName);
      loadManifest(selectedName);
    }
  }, [selectedName, loadSelectedDoc, loadManifest]);

  const handleRotate = async () => {
    if (!selectedName) return;
    try {
      setLoading(true);
      await daemon.rotateKid(selectedName);
      alert(`Successfully rotated keys for ${selectedName} and published update.`);
      await loadKids();
      await loadSelectedDoc(selectedName);
      await loadManifest(selectedName);
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

  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    const idTrimmed = srvId.trim().toLowerCase().replace(/^#/, '');
    const endpointTrimmed = srvEndpoint.trim();

    if (!idTrimmed) {
      alert("Please provide a service ID (e.g. 'web' or 'api')");
      return;
    }
    if (!endpointTrimmed) {
      alert("Please provide an endpoint URL or address (e.g. 'https://saif.kin')");
      return;
    }
    if (services.some(s => s.id.toLowerCase() === idTrimmed)) {
      alert(`A service with ID "#${idTrimmed}" already exists.`);
      return;
    }

    setServices(prev => [
      ...prev,
      {
        id: idTrimmed,
        type: srvType.trim() || 'website',
        protocol: srvProtocol.trim() || 'https',
        endpoint: endpointTrimmed,
      }
    ]);
    setSrvId('');
    setSrvEndpoint('');
  };

  const handleRemoveService = (index: number) => {
    setServices(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveManifest = async () => {
    if (!selectedName) return;
    try {
      setManifestSaving(true);
      setManifestError(null);
      setManifestSuccess(null);
      const res = await daemon.updateKidManifest(selectedName, services);
      if (res.success) {
        setManifest(res.manifest);
        setManifestSuccess(`Successfully signed & published Capability Manifest (v${res.manifest.version}) to DHT.`);
      }
    } catch (err) {
      setManifestError(`Failed to save manifest: ${String(err)}`);
    } finally {
      setManifestSaving(false);
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
          {/* Identity Card */}
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
                        <span className={styles.keyType}>{ck.key_type || 'KineticKeypair'}</span>: 
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
                  This identity has been permanently deactivated on the network. Key rotation and service publishing are disabled.
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
                    Rotate generates a new Controller Key. Revoke permanently deactivates this identity across the network.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Capability Manifest & Service Endpoints */}
          <div className={styles.section}>
            <div className={styles.manifestHeader}>
              <div>
                <h2 className={styles.sectionTitle}>Capability Manifest & Service Endpoints</h2>
                <p className="text-secondary" style={{ fontSize: '0.85rem', marginTop: '2px' }}>
                  Manage the cryptographic service pointers and endpoints published for this DID identity.
                </p>
              </div>
              <div className={styles.manifestMeta}>
                {manifest && (
                  <span className={styles.versionBadge}>v{manifest.version}</span>
                )}
                <span>{services.length} {services.length === 1 ? 'service' : 'services'}</span>
              </div>
            </div>

            {manifestSuccess && (
              <div style={{ padding: '8px 12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 'var(--r-sm)', color: '#10b981', fontSize: '0.85rem' }}>
                {manifestSuccess}
              </div>
            )}

            {manifestError && (
              <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--r-sm)', color: '#ef4444', fontSize: '0.85rem' }}>
                {manifestError}
              </div>
            )}

            {manifestLoading ? (
              <p className="text-secondary">Loading capability manifest…</p>
            ) : (
              <>
                {services.length === 0 ? (
                  <div className={styles.emptyState}>
                    No capability endpoints configured yet. Add website, API, or service endpoints below.
                  </div>
                ) : (
                  <table className={styles.serviceTable}>
                    <thead>
                      <tr>
                        <th>Fragment ID</th>
                        <th>Type</th>
                        <th>Protocol</th>
                        <th>Endpoint URL</th>
                        <th style={{ textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {services.map((srv, idx) => (
                        <tr key={srv.id || idx}>
                          <td>
                            <span className={styles.monoText}>#{srv.id}</span>
                          </td>
                          <td>
                            <span className={styles.serviceTag}>{srv.type}</span>
                          </td>
                          <td>
                            <span className={styles.protocolTag}>{srv.protocol}</span>
                          </td>
                          <td>
                            {srv.endpoint.startsWith('http://') || srv.endpoint.startsWith('https://') ? (
                              <a 
                                href={srv.endpoint} 
                                target="_blank" 
                                rel="noreferrer" 
                                className={styles.endpointLink}
                              >
                                {srv.endpoint}
                              </a>
                            ) : (
                              <span className={styles.monoText}>{srv.endpoint}</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className={styles.removeBtn}
                              onClick={() => handleRemoveService(idx)}
                              disabled={isDeactivated || manifestSaving}
                              title="Remove service"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Add Service Box */}
                {!isDeactivated && (
                  <form onSubmit={handleAddService} className={styles.addServiceBox}>
                    <span className={styles.addServiceBoxTitle}>+ Add Service Endpoint</span>
                    <div className={styles.addServiceGrid}>
                      <input
                        type="text"
                        className="input"
                        placeholder="ID (e.g. web, api)"
                        value={srvId}
                        onChange={e => setSrvId(e.target.value)}
                        disabled={manifestSaving}
                      />
                      <select
                        className="input"
                        value={srvType}
                        onChange={e => setSrvType(e.target.value)}
                        disabled={manifestSaving}
                      >
                        <option value="website">Website</option>
                        <option value="api">API</option>
                        <option value="messaging">Messaging</option>
                        <option value="authentication">Auth Service</option>
                        <option value="storage">Storage</option>
                        <option value="custom">Custom</option>
                      </select>
                      <select
                        className="input"
                        value={srvProtocol}
                        onChange={e => setSrvProtocol(e.target.value)}
                        disabled={manifestSaving}
                      >
                        <option value="https">https</option>
                        <option value="http">http</option>
                        <option value="wss">wss</option>
                        <option value="ws">ws</option>
                        <option value="grpc">grpc</option>
                        <option value="ipfs">ipfs</option>
                      </select>
                      <input
                        type="text"
                        className="input"
                        placeholder="Endpoint URL (e.g. https://saif.kin)"
                        value={srvEndpoint}
                        onChange={e => setSrvEndpoint(e.target.value)}
                        disabled={manifestSaving}
                      />
                      <button
                        type="submit"
                        className="btn-ghost"
                        disabled={manifestSaving || !srvId.trim() || !srvEndpoint.trim()}
                      >
                        Add
                      </button>
                    </div>
                  </form>
                )}

                {/* Save and Publish Button */}
                <div className={styles.saveManifestRow}>
                  <p className="text-secondary" style={{ fontSize: '0.8rem', margin: 0 }}>
                    Saving increments manifest version, creates cryptographic signature, and publishes to the DHT.
                  </p>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleSaveManifest}
                    disabled={isDeactivated || manifestSaving || manifestLoading}
                  >
                    {manifestSaving ? 'Signing & Publishing...' : 'Save & Publish Manifest'}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Generate Subname KID */}
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
