import { useState, useEffect, useRef } from 'react';
import { daemon, NetworkStatus } from '../api/daemon';
import { IconCopy } from '../components/Icons';
import styles from './Network.module.css';

interface GossipEvent {
  id: string;
  time: string;
  payload: string;
}

export default function Network() {
  const [peerId, setPeerId] = useState<string>('');
  const [status, setStatus] = useState<NetworkStatus | null>(null);
  const [events, setEvents] = useState<GossipEvent[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    daemon.getPeerId().then(setPeerId).catch(console.error);
    
    const fetchStatus = () => daemon.getNetworkStatus().then(setStatus).catch(console.error);
    fetchStatus();
    const int = setInterval(fetchStatus, 5000);
    return () => clearInterval(int);
  }, []);

  useEffect(() => {
    const sse = new EventSource('http://127.0.0.1:16002/api/gossip/subscribe/names');
    
    sse.onmessage = (e) => {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0]; // HH:MM:SS
      const newEvent: GossipEvent = {
        id: Math.random().toString(36).slice(2),
        time: timeStr,
        payload: e.data
      };
      
      setEvents(prev => {
        const next = [...prev, newEvent];
        if (next.length > 200) next.shift();
        return next;
      });
    };

    return () => sse.close();
  }, []);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events]);

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

      <div className={styles.feedContainer}>
        <h2 className={styles.title} style={{ fontSize: 'var(--text-lg)' }}>Live Gossip Feed</h2>
        <div className={styles.feedWindow} ref={feedRef}>
          {events.length === 0 ? (
            <div className={styles.emptyFeed}>Waiting for gossip events...</div>
          ) : (
            events.map(ev => (
              <div key={ev.id} className={styles.feedLine}>
                <span className={styles.time}>[{ev.time}]</span>
                <span className={styles.payload}>{ev.payload}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
