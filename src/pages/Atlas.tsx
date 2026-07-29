import { useState, useEffect, useCallback } from 'react';
import { daemon, AtlasNetwork } from '../api/daemon';
import styles from './Atlas.module.css';

type InstallState = 'idle' | 'installing' | 'done' | 'error';

interface NetworkCardProps {
  net: AtlasNetwork;
}

function NetworkCard({ net }: NetworkCardProps) {
  const [state, setState] = useState<InstallState>('idle');
  const [msg, setMsg] = useState('');

  // Derive a sensible daemon binary name from the TLD.
  // Convention: {tld}-daemon  (e.g. "uni" → "uni-daemon")
  // Fork operators follow Kinetic's own naming in their release.yml.
  const daemonName = `${net.tld}-daemon`;

  const handleInstall = async () => {
    if (!net.binary_download) {
      setMsg('No binary download URL registered for this network.');
      setState('error');
      return;
    }
    setState('installing');
    setMsg('');
    try {
      const result = await daemon.installForkDaemon(
        net.tld,
        daemonName,
        net.binary_download,
      );
      setMsg(result);
      setState('done');
    } catch (err) {
      setMsg(String(err));
      setState('error');
    }
  };

  return (
    <div className={styles.networkCard}>
      {/* Logo */}
      <div className={styles.cardLogo}>
        {net.logo ? (
          <img src={net.logo} alt={`${net.name ?? net.tld} logo`} className={styles.logoImg} />
        ) : (
          <div className={styles.logoFallback}>{(net.tld ?? '?').slice(0, 2).toUpperCase()}</div>
        )}
      </div>

      {/* Info */}
      <div className={styles.cardInfo}>
        <div className={styles.cardHeader}>
          <span className={styles.networkName}>{net.name ?? net.tld}</span>
          <span className={styles.tldChip}>.{net.tld}</span>
        </div>

        {net.desc && (
          <p className={styles.networkDesc}>{net.desc}</p>
        )}

        <div className={styles.metaRow}>
          {net.bootstrap_nodes && (
            <span className={styles.metaTag}>
              {net.bootstrap_nodes.length} bootstrap nodes
            </span>
          )}
          {net.seed_domain && (
            <span className={styles.metaTag}>{net.seed_domain}</span>
          )}
        </div>
      </div>

      {/* Action */}
      <div className={styles.cardAction}>
        {state === 'idle' && (
          <button className="btn-primary" onClick={handleInstall}>
            Install
          </button>
        )}
        {state === 'installing' && (
          <div className={styles.installProgress}>
            <div className={styles.spinner} />
            <span>Installing…</span>
          </div>
        )}
        {state === 'done' && (
          <div className={styles.installResult} data-ok>
            <span>✓ Installed</span>
          </div>
        )}
        {state === 'error' && (
          <div className={styles.installResult} data-err>
            <span>✗ Failed</span>
            <button
              className="btn-ghost"
              style={{ marginTop: '4px', fontSize: '11px' }}
              onClick={() => { setState('idle'); setMsg(''); }}
            >
              Retry
            </button>
          </div>
        )}
        {msg && (
          <p className={styles.installMsg}>{msg}</p>
        )}
      </div>
    </div>
  );
}

export default function Atlas() {
  const [networks, setNetworks] = useState<AtlasNetwork[]>([]);
  const [loading, setLoading]  = useState(true);
  const [syncing, setSyncing]  = useState(false);
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

  useEffect(() => {
    loadNetworks();
  }, [loadNetworks]);

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

      {/* ── Page header ── */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className="eyebrow">NETWORK MARKETPLACE</span>
          <h1 className={styles.title}>Atlas</h1>
          <p className={styles.subtitle}>
            Discover and install Kinetic fork networks with one click.
          </p>
        </div>
        <button
          className="btn-ghost"
          onClick={handleSync}
          disabled={syncing || loading}
        >
          {syncing ? 'Syncing…' : 'Refresh Atlas'}
        </button>
      </div>

      {/* ── Network cards ── */}
      <section className={styles.section}>
        {loading && (
          <div className={styles.stateMsg}>
            <div className={styles.spinner} />
            <span>Fetching networks from Atlas…</span>
          </div>
        )}

        {!loading && atlasError && (
          <div className={styles.stateMsg} data-err>
            <span>Could not load Atlas registry.</span>
            <span className={styles.errorDetail}>{atlasError}</span>
            <button className="btn-ghost" onClick={loadNetworks} style={{ marginTop: '8px' }}>
              Retry
            </button>
          </div>
        )}

        {!loading && !atlasError && networks.length === 0 && (
          <div className={styles.stateMsg}>
            <span>No networks registered yet.</span>
          </div>
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
