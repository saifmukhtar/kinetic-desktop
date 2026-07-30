import { useState, useEffect, useCallback } from 'react';
import { daemon, AtlasNetwork } from '../api/daemon';
import styles from './Atlas.module.css';

function getRawReadmeUrl(repo?: string): string | null {
  if (!repo) return null;
  const clean = repo.trim().replace(/\/$/, '');
  if (clean.includes('github.com')) {
    const path = clean.replace(/^https?:\/\/github\.com\//, '');
    return `https://raw.githubusercontent.com/${path}/main/README.md`;
  }
  if (clean.includes('gitlab.com')) {
    return `${clean}/-/raw/main/README.md`;
  }
  return null;
}

function NetworkCard({ net, onSelect }: { net: AtlasNetwork; onSelect: (net: AtlasNetwork) => void }) {
  return (
    <div className={styles.networkCard} onClick={() => onSelect(net)}>
      {/* ── Upper Header: network_id & tld badge ── */}
      <div className={styles.cardHeader}>
        <span className={styles.networkName}>{net.network_id ?? net.name ?? net.tld}</span>
        <span className={styles.tldChip}>.{net.tld}</span>
      </div>

      {/* ── Upper-Middle: Logo ── */}
      <div className={styles.cardLogoSection}>
        {net.logo ? (
          <img src={net.logo} alt={`${net.network_id ?? net.tld} logo`} className={styles.logoImg} />
        ) : (
          <div className={styles.logoFallback}>{(net.tld ?? '?').slice(0, 2).toUpperCase()}</div>
        )}
      </div>

      {/* ── Lower Footer: Description, Meta & Install Button ── */}
      <div className={styles.cardFooter}>
        {net.desc && (
          <p className={styles.networkDesc}>{net.desc}</p>
        )}

        <div className={styles.metaRow}>
          {net.local_bind_ip && (
            <span className={styles.metaTag}>{net.local_bind_ip}</span>
          )}
          {net.api_port && (
            <span className={styles.metaTag}>:{net.api_port}</span>
          )}
        </div>

        <button
          className="btn-primary"
          style={{ width: '100%', marginTop: '4px', fontSize: '11px', padding: '6px 10px' }}
          onClick={(e) => {
            e.stopPropagation();
            const targetUrl = net.binary_download || net.repo || 'https://github.com/saifmukhtar/kinetic-atlas';
            window.open(targetUrl, '_blank');
          }}
        >
          Install Network
        </button>
      </div>
    </div>
  );
}

export default function Atlas() {
  const [networks, setNetworks] = useState<AtlasNetwork[]>([]);
  const [loading, setLoading]  = useState(true);
  const [syncing, setSyncing]  = useState(false);
  const [atlasError, setAtlasError] = useState<string | null>(null);
  const [selectedNet, setSelectedNet] = useState<AtlasNetwork | null>(null);
  const [readmeText, setReadmeText] = useState<string | null>(null);
  const [readmeLoading, setReadmeLoading] = useState(false);

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

  useEffect(() => {
    if (!selectedNet) {
      setReadmeText(null);
      return;
    }
    const rawUrl = getRawReadmeUrl(selectedNet.repo);
    if (!rawUrl) {
      setReadmeText(selectedNet.desc ?? "No repository README available.");
      return;
    }
    setReadmeLoading(true);
    fetch(rawUrl)
      .then((res) => (res.ok ? res.text() : Promise.reject('Failed to fetch README')))
      .then((text) => {
        const cleanText = text
          .replace(/^#+\s+/gm, '')
          .replace(/!\[.*?\]\(.*?\)/g, '')
          .trim();
        setReadmeText(cleanText.slice(0, 450) + (cleanText.length > 450 ? '…' : ''));
      })
      .catch(() => {
        setReadmeText(selectedNet.desc ?? "Could not fetch README from repository.");
      })
      .finally(() => setReadmeLoading(false));
  }, [selectedNet]);

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
            Discover Kinetic fork networks and Top-Level Domains.
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
              <NetworkCard key={net.tld} net={net} onSelect={setSelectedNet} />
            ))}
          </div>
        )}
      </section>

      {/* ── Slide-in Drawer for Selected Network ── */}
      {selectedNet && (
        <div className={styles.overlay} onClick={() => setSelectedNet(null)}>
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <div>
                <span className="eyebrow">.{selectedNet.tld} NETWORK</span>
                <h2 className={styles.drawerTitle}>{selectedNet.network_id ?? selectedNet.name}</h2>
              </div>
              <button className="btn-ghost" onClick={() => setSelectedNet(null)}>✕</button>
            </div>

            <div className={styles.drawerBody}>
              <div className={styles.drawerMeta}>
                <span className={styles.metaTag}>IP: {selectedNet.local_bind_ip ?? '127.0.0.1'}</span>
                <span className={styles.metaTag}>Port: {selectedNet.api_port ?? '16002'}</span>
              </div>

              <div className={styles.readmeBox}>
                <span className="eyebrow">REPOSITORY README PREVIEW</span>
                {readmeLoading ? (
                  <div className={styles.spinnerRow}>
                    <div className={styles.spinner} />
                    <span>Fetching live README from repository…</span>
                  </div>
                ) : (
                  <p className={styles.readmeContent}>{readmeText}</p>
                )}
              </div>
            </div>

            <div className={styles.drawerFooter}>
              {selectedNet.repo && (
                <button
                  className="btn-ghost"
                  onClick={() => window.open(selectedNet.repo, '_blank')}
                >
                  View Repository
                </button>
              )}
              <button
                className="btn-primary"
                onClick={() => {
                  const targetUrl = selectedNet.binary_download || selectedNet.repo || 'https://github.com/saifmukhtar/kinetic-atlas';
                  window.open(targetUrl, '_blank');
                }}
              >
                Install Network
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
