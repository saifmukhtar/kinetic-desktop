import { useState, useEffect, useCallback } from 'react';
import { daemon, AtlasNetwork } from '../api/daemon';
import styles from './Atlas.module.css';

function NetworkCard({ net }: { net: AtlasNetwork }) {
  return (
    <div className={styles.networkCard}>
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

export default function Atlas() {
  const [networks, setNetworks] = useState<AtlasNetwork[]>([]);
  const [loading, setLoading]   = useState(true);
  const [syncing, setSyncing]   = useState(false);
  const [atlasError, setAtlasError] = useState<string | null>(null);

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
              <NetworkCard key={net.tld} net={net} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
