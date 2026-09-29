import { useState, useEffect, useCallback } from 'react';
import { daemon, AtlasNetwork } from '../api/daemon';
import { IconHelp } from '../components/Icons';
import styles from './Atlas.module.css';

function NetworkCard({ net, onClick }: { net: AtlasNetwork, onClick: () => void }) {
  return (
    <div className={styles.networkCard} onClick={onClick} role="button" tabIndex={0}>
      <div className={styles.cardHeader}>
        <span className={styles.networkName}>{net.network_id ?? net.name ?? net.tld}</span>
        <span className={styles.tldChip}>.{net.tld}</span>
      </div>
      <div className={styles.cardLogoSection}>
        {net.logo ? (
          <img src={net.logo} alt={`${net.tld} logo`} className={styles.logoImg} />
        ) : (
          <div className={styles.logoFallback}>{(net.tld ?? '?').slice(0, 2).toUpperCase()}</div>
        )}
      </div>
      <div className={styles.cardFooter}>
        {net.desc && <p className={styles.networkDesc}>{net.desc}</p>}
        <div className={styles.metaRow}>
          {net.local_bind_ip && <span className={styles.metaTag}>{net.local_bind_ip}</span>}
          {net.api_port && <span className={styles.metaTag}>:{net.api_port}</span>}
        </div>
      </div>
    </div>
  );
}


function NetworkModal({ net, onClose }: { net: AtlasNetwork, onClose: () => void }) {
  const [installMode, setInstallMode] = useState<'minimal' | 'full'>('full');
  const [installStep, setInstallStep] = useState<'initial' | 'downloading' | 'downloaded' | 'installing' | 'success'>('initial');
  
  // Update state to handle full InstallStatus
  const [installStatus, setInstallStatus] = useState<{ is_installed: boolean; install_type: string | null } | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);

  useEffect(() => {
    // Check if installed on mount
    const check = async () => {
      try {
        const status = await daemon.checkInstalled(net.network_id || net.tld);
        setInstallStatus(status);
        if (status.is_installed && status.install_type) {
          setInstallMode(status.install_type as 'minimal' | 'full');
        }
      } catch (e) {
        console.error("Failed to check installation status", e);
      }
    };
    check();
  }, [net]);

  const handleDownload = async () => {
    setInstallStep('downloading');
    setInstallError(null);
    try {
      if (!net.binary_download) throw new Error("No binary download URL provided for this network.");
      const baseUrl = net.binary_download;
      await daemon.downloadBinaries(net.network_id || net.tld, installMode, baseUrl);
      setInstallStep('downloaded');
    } catch (e) {
      setInstallError(String(e));
      setInstallStep('initial');
    }
  };

  const handleInstall = async () => {
    setInstallStep('installing');
    setInstallError(null);
    try {
      await daemon.installBinaries(net.network_id || net.tld, installMode);
      setInstallStep('success');
    } catch (e) {
      setInstallError(String(e));
      setInstallStep('downloaded');
    }
  };

  const isUpdate = installStatus?.is_installed === true;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{net.name || net.network_id} (.{net.tld})</h2>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          {net.desc && <p className={styles.modalDesc}>{net.desc}</p>}

          <div className={styles.installSection}>
            {installStatus !== null ? (
              <>
                {installStep === 'initial' && (
                  <div className={styles.installFlow}>
                    {isUpdate ? (
                      <>
                        <h3 className={styles.installTitle}>Update Available</h3>
                        <p className={styles.installHint}>
                          This network is currently installed with a <strong>{installMode}</strong> profile. 
                          Clicking Update will safely stop the running services, download the latest version, and restart them.
                        </p>
                        {installError && <div className={styles.errorMsg}>{installError}</div>}
                        <button className="btn-primary" onClick={handleDownload}>Update Network</button>
                      </>
                    ) : (
                      <>
                        <h3 className={styles.installTitle}>Installation Profile</h3>
                        <div className={styles.radioGroup}>
                          <label className={styles.radioLabel}>
                            <input type="radio" checked={installMode === 'full'} onChange={() => setInstallMode('full')} />
                            <div className={styles.radioText}>
                              <strong>Normal User (Full Install)</strong>
                              <span>Installs Daemon, CLI, DNS Proxy, and PAC Router.</span>
                            </div>
                            <div className={styles.helpIconWrapper}>
                              <IconHelp size={14} />
                              <div className={styles.tooltip}>
                                Recommended for standard users. Runs the PAC proxy to seamlessly resolve decentralized names natively inside your browser.
                              </div>
                            </div>
                          </label>
                          <label className={styles.radioLabel}>
                            <input type="radio" checked={installMode === 'minimal'} onChange={() => setInstallMode('minimal')} />
                            <div className={styles.radioText}>
                              <strong>Restricted User (Minimal Install)</strong>
                              <span>Installs only Daemon and CLI. (For restricted use cases)</span>
                            </div>
                            <div className={styles.helpIconWrapper}>
                              <IconHelp size={14} />
                              <div className={styles.tooltip}>
                                Ideal for corporate laptops or servers where system-level proxy configurations are locked down or prohibited.
                              </div>
                            </div>
                          </label>
                        </div>
                        {installError && <div className={styles.errorMsg}>{installError}</div>}
                        <button className="btn-primary" onClick={handleDownload}>Download Package</button>
                      </>
                    )}
                  </div>
                )}

                {installStep === 'downloading' && (
                  <div className={styles.stateMsg}>
                    <div className={styles.spinner} />
                    <span>Downloading {installMode} package...</span>
                  </div>
                )}

                {installStep === 'downloaded' && (
                  <div className={styles.installFlow}>
                    <div className={styles.successMsg}>✓ Package downloaded successfully.</div>
                    <p className={styles.installHint}>
                      {isUpdate 
                        ? "Click below to overwrite existing binaries. You will be prompted for Administrator privileges."
                        : "Click Install to copy binaries to your system and register background services. You will be prompted for Administrator privileges."}
                    </p>
                    {installError && <div className={styles.errorMsg}>{installError}</div>}
                    <button className="btn-primary" onClick={handleInstall}>{isUpdate ? "Install Update" : "Install Now"}</button>
                  </div>
                )}

                {installStep === 'installing' && (
                  <div className={styles.stateMsg}>
                    <div className={styles.spinner} />
                    <span>{isUpdate ? "Stopping services and overwriting..." : "Installing and starting services..."} (Waiting for permissions)</span>
                  </div>
                )}

                {installStep === 'success' && (
                  <div className={styles.stateMsg} style={{ color: 'var(--color-success)' }}>
                    <h2>✓ {isUpdate ? "Update Complete" : "Installation Complete"}</h2>
                    <p>The Kinetic {installMode} node is now running in the background!</p>
                  </div>
                )}
              </>
            ) : (
              <div className={styles.stateMsg}>
                <div className={styles.spinner} />
                <span>Checking system...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Atlas() {
  const [networks, setNetworks] = useState<AtlasNetwork[]>([]);
  const [loading, setLoading]   = useState(true);
  const [syncing, setSyncing]   = useState(false);
  const [atlasError, setAtlasError] = useState<string | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<AtlasNetwork | null>(null);



  const loadNetworks = useCallback(async () => {
    setLoading(true);
    setAtlasError(null);
    try {
      const nets = await daemon.getAtlasNetworks();
      setNetworks(Array.isArray(nets) ? nets : []);
    } catch (err) {
      setAtlasError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadNetworks(); }, [loadNetworks]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await daemon.syncAtlas();
      await loadNetworks();
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  const closeModal = () => setSelectedNetwork(null);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className="eyebrow">NETWORK MARKETPLACE</span>
          <h1 className={styles.title}>Atlas</h1>
          <p className={styles.subtitle}>Discover Kinetic fork networks and Top-Level Domains.</p>
        </div>
        <button className="btn-ghost" onClick={handleSync} disabled={syncing || loading}>
          {syncing ? 'Syncing…' : 'Refresh Atlas'}
        </button>
      </div>

      <section className={styles.section}>
        {loading && (
          <div className={styles.stateMsg}>
            <div className={styles.spinner} />
            <span>Fetching networks from Atlas…</span>
          </div>
        )}
        {!loading && atlasError && (
          <div className={styles.stateMsg}>
            <span>Could not load Atlas registry.</span>
            <span className={styles.errorDetail}>{atlasError}</span>
            <button className="btn-ghost" onClick={loadNetworks} style={{ marginTop: '8px' }}>Retry</button>
          </div>
        )}
        {!loading && !atlasError && networks.length === 0 && (
          <div className={styles.stateMsg}><span>No networks registered yet.</span></div>
        )}
        {!loading && !atlasError && networks.length > 0 && (
          <div className={styles.networkGrid}>
            {networks.map((net) => (
              <NetworkCard key={net.tld} net={net} onClick={() => setSelectedNetwork(net)} />
            ))}
          </div>
        )}
      </section>

      {selectedNetwork && (
        <NetworkModal net={selectedNetwork} onClose={closeModal} />
      )}
    </div>
  );
}
