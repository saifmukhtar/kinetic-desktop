import { useState, useEffect } from 'react';
import { daemon, NetworkStatus } from '../api/daemon';
import { IconCopy } from '../components/Icons';
import styles from './Network.module.css';

import GossipFeed from '../components/GossipFeed';

export default function Network() {
  const [peerId, setPeerId] = useState<string>('');
  const [status, setStatus] = useState<NetworkStatus | null>(null);


  useEffect(() => {
    daemon.getPeerId().then(setPeerId).catch(console.error);
    
    const fetchStatus = () => daemon.getNetworkStatus().then(setStatus).catch(console.error);
    fetchStatus();
    const int = setInterval(fetchStatus, 5000);
    return () => clearInterval(int);
  }, []);


  const copyPeerId = () => {
    navigator.clipboard.writeText(peerId);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className="eyebrow">NETWORK</span>
        <h1 className={styles.title}>Network Status</h1>
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
          <span className={styles.statLabel}>Peers</span>
          <span className={styles.statValue}>{status?.peer_count ?? 0}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Drand Pulse</span>
          <span className={styles.statValue}>{status?.drand_pulse ?? 0}</span>
        </div>
      </div>

      <GossipFeed />
    </div>
  );
}
