import { useState, useEffect, useRef } from 'react';
import styles from './GossipFeed.module.css';

interface GossipEvent {
  id: string;
  time: string;
  payload: string;
}

export default function GossipFeed() {
  const [events, setEvents] = useState<GossipEvent[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);

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

  return (
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
  );
}
