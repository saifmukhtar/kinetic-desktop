import { useState, useEffect } from 'react';
import { daemon, NetworkStatus } from '../api/daemon';
import { IconCopy } from '../components/Icons';
import { toast } from 'sonner';
import styles from './Network.module.css';

import GossipFeed from '../components/GossipFeed';

export default function Network() {
  const [peerId, setPeerId] = useState<string>('');
  const [status, setStatus] = useState<NetworkStatus | null>(null);
  
  const [natStatus, setNatStatus] = useState<string>('Unknown');
  const [peers, setPeers] = useState<string[]>([]);
  const [bannedPeers, setBannedPeers] = useState<string[]>([]);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [actionStatus, setActionStatus] = useState<any>(null);

  useEffect(() => {
    daemon.getPeerId().then(setPeerId).catch(console.error);
    
    const fetchStatus = () => {
      daemon.getNetworkStatus().then(setStatus).catch(console.error);
      daemon.getNetworkNat().then(setNatStatus).catch(console.error);
      daemon.getNetworkPeers().then(setPeers).catch(console.error);
      daemon.getBannedPeers().then(setBannedPeers).catch(console.error);
      daemon.getActionStatus().then(setActionStatus).catch(() => setActionStatus(null));
    };
    
    fetchStatus();
    const int = setInterval(fetchStatus, 5000);
    return () => clearInterval(int);
  }, []);

  const copyPeerId = () => {
    navigator.clipboard.writeText(peerId);
  };

  const handleBootstrap = async () => {
    setBootstrapping(true);
    try {
      await daemon.triggerNetworkBootstrap();
      // immediately refresh peers
      const p = await daemon.getNetworkPeers();
      setPeers(p);
    } catch (err) {
      console.error("Bootstrap failed", err);
    } finally {
      setBootstrapping(false);
    }
  };

  const handleDnsFlush = async () => {
    try {
      await daemon.postDnsFlush();
      toast.success("Local DNS cache flushed successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to flush DNS cache");
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span className="eyebrow">NETWORK</span>
          <h1 className={styles.title}>Network Status</h1>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          <button className="btn-ghost" onClick={handleDnsFlush} title="Clear internal Kinetic DNS resolver cache">
            Flush DNS
          </button>
          <button className="btn-ghost" onClick={handleBootstrap} disabled={bootstrapping}>
            {bootstrapping ? 'Bootstrapping...' : 'Force Sync'}
          </button>
        </div>
      </div>

      <div className={styles.peerCard}>
        <div className={styles.peerId}>{peerId || 'Loading...'}</div>
        <button className="btn-icon" onClick={copyPeerId} title="Copy Peer ID">
          <IconCopy />
        </button>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Mode</span>
          <span className={styles.statValue}>{status?.mode || 'Unknown'}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>NAT Status</span>
          <span className={styles.statValue}>{natStatus}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Peers</span>
          <span className={styles.statValue}>{status?.peer_count ?? 0}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Network Kyn</span>
          <span className={styles.statValue}>{status?.network_kyn ?? 0}</span>
        </div>
      </div>

      {actionStatus && (
        <div className={styles.peerCard} style={{ marginTop: 'var(--sp-4)', flexDirection: 'column', alignItems: 'flex-start' }}>
          <span className={styles.tableTitle} style={{ marginBottom: '8px' }}>Active Network Action</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '13px', color: 'var(--ink-muted)' }}>
            <span><strong>ID:</strong> {actionStatus.action_id}</span>
            <span><strong>State:</strong> {actionStatus.state}</span>
          </div>
          <div style={{ width: '100%', height: '4px', background: 'var(--bg-base)', borderRadius: '2px', marginTop: '8px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${actionStatus.progress}%`, background: 'var(--accent-base)' }} />
          </div>
        </div>
      )}

      <div className={styles.routingSection}>
        <div className={styles.tablePanel}>
          <span className={styles.tableTitle}>Routing Table</span>
          <ul className={styles.peerList}>
            {peers.length === 0 ? <li className={styles.peerItem}>No active peers</li> : peers.map((p, i) => (
              <li key={i} className={styles.peerItem}>{p}</li>
            ))}
          </ul>
        </div>
        
        <div className={styles.tablePanel}>
          <span className={styles.tableTitle}>Banned Peers</span>
          <ul className={styles.peerList}>
            {bannedPeers.length === 0 ? <li className={styles.peerItem}>No banned peers</li> : bannedPeers.map((p, i) => (
              <li key={i} className={styles.peerItem} style={{ color: 'var(--status-err)', borderColor: 'var(--status-err)' }}>{p}</li>
            ))}
          </ul>
        </div>
      </div>

      <GossipFeed />
    </div>
  );
}
