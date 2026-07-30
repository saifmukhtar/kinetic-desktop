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

      {/* ── Lower Footer: Description & IP/Port ── */}
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
      </div>
    </div>
  );
}

function ReadmeModal({ net, onClose }: { net: AtlasNetwork; onClose: () => void }) {
  const [readmeText, setReadmeText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    setReadmeText(null);
    setFetchError(false);

    const rawUrl = getRawReadmeUrl(net.repo);
    if (!rawUrl) {
      // No repo at all — nothing to fetch
      return;
    }

    setLoading(true);
    fetch(rawUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        const clean = text
          .replace(/<[^>]+>/g, '')              // strip all HTML tags
          .replace(/!\[.*?\]\(.*?\)/g, '')      // strip markdown images
          .replace(/^\s*#{1,6}\s+.*/gm, '')     // strip headings entirely
          .replace(/`{3}[\s\S]*?`{3}/gm, '')    // strip fenced code blocks
          .replace(/`[^`]+`/g, '')              // strip inline code
          .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → just text
          .replace(/\*{1,2}([^*\n]+)\*{1,2}/g, '$1') // bold/italic → text
          .replace(/^[-*_]{3,}\s*$/gm, '')      // strip horizontal rules
          .replace(/^\s*[-*+]\s+/gm, '')        // strip list bullets
          .replace(/^\s*\d+\.\s+/gm, '')        // strip numbered lists
          .replace(/^>\s+/gm, '')               // strip blockquotes
          .replace(/\n{3,}/g, '\n\n')           // collapse blank lines
          .split('\n')
          .map(l => l.trim())
          .filter(l => l.length > 0)            // drop empty lines
          .join('\n')
          .trim();
        if (!clean) {
          setFetchError(true);
        } else {
          setReadmeText(clean.slice(0, 700) + (clean.length > 700 ? '…' : ''));
        }
      })
      .catch(() => {
        setFetchError(true);
      })
      .finally(() => setLoading(false));
  }, [net]);

  const hasRepo = !!net.repo;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <span className="eyebrow">.{net.tld} · README</span>
            <h2 className={styles.modalTitle}>{net.network_id ?? net.name ?? net.tld}</h2>
          </div>
          <button className="btn-ghost" onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          {!hasRepo && (
            <p className={styles.noRepo}>No repository linked for this network.</p>
          )}
          {hasRepo && loading && (
            <div className={styles.modalLoading}>
              <div className={styles.spinner} />
              <span>Fetching README…</span>
            </div>
          )}
          {hasRepo && !loading && fetchError && (
            <div className={styles.fetchError}>
              <p>Could not fetch README — CORS restriction in browser preview.</p>
              <p style={{ marginTop: '6px', fontSize: '11px', color: 'var(--ink-muted)' }}>
                This will work correctly inside the Tauri desktop app.
              </p>
            </div>
          )}
          {hasRepo && !loading && !fetchError && readmeText && (
            <p className={styles.readmeContent}>{readmeText}</p>
          )}
          {hasRepo && net.repo && (
            <a
              className={styles.repoLink}
              href={net.repo}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              View full repository →
            </a>
          )}
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
  const [selectedNet, setSelectedNet] = useState<AtlasNetwork | null>(null);

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
      {/* ── Page header ── */}
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
            <button className="btn-ghost" onClick={loadNetworks} style={{ marginTop: '8px' }}>Retry</button>
          </div>
        )}
        {!loading && !atlasError && networks.length === 0 && (
          <div className={styles.stateMsg}><span>No networks registered yet.</span></div>
        )}
        {!loading && !atlasError && networks.length > 0 && (
          <div className={styles.networkGrid}>
            {networks.map((net) => (
              <NetworkCard key={net.tld} net={net} onSelect={setSelectedNet} />
            ))}
          </div>
        )}
      </section>

      {/* ── Small centered overlay on card click ── */}
      {selectedNet && (
        <ReadmeModal net={selectedNet} onClose={() => setSelectedNet(null)} />
      )}
    </div>
  );
}
