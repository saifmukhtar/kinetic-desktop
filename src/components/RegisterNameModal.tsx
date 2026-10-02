import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { daemon } from '../api/daemon';
import styles from './RegisterNameModal.module.css';
import VdfProgress from './VdfProgress';

interface RegisterNameModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function RegisterNameModal({ onClose, onSuccess }: RegisterNameModalProps) {
  const [registerName, setRegisterName] = useState('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [iterations, setIterations] = useState<{ count: number; time?: number } | null>(null);

  useEffect(() => {
    if (!taskId) return;
    const interval = setInterval(async () => {
      try {
        const status = await daemon.getVdfStatus(taskId);
        setProgress(status.progress);
        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(interval);
          setTaskId(null);
          
          if (status.status === 'completed') {
            onSuccess();
            onClose();
          }
        }
      } catch (err) {
        console.error(err);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [taskId, onClose, onSuccess]);

  useEffect(() => {
    if (!registerName || registerName.length < 3) {
      setIterations(null);
      return;
    }
    const timeoutId = setTimeout(async () => {
      try {
        const res = await daemon.getVdfIterations(registerName);
        setIterations({ count: res.iterations, time: res.estimated_seconds });
      } catch (e) {
        console.error("Failed to get VDF iterations", e);
        setIterations(null);
      }
    }, 500); // debounce typing
    return () => clearTimeout(timeoutId);
  }, [registerName]);

  async function startRegistration() {
    if (!registerName) return;
    try {
      const res = await daemon.registerVdf({ name: registerName });
      setTaskId(res.task_id);
      setProgress(0);
    } catch (err) {
      console.error(err);
    }
  }

  return createPortal(
    <div className={styles.overlay} onClick={taskId ? undefined : onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Register Name</h2>
          <button className={styles.closeBtn} onClick={onClose} disabled={!!taskId}>✕</button>
        </div>

        <div className={styles.content}>
          <div className={styles.switchSection} style={{ borderBottom: 'none', paddingBottom: '0' }}>
            <div className={styles.switchInfo}>
              <span className={styles.switchTitle}>Namespace Registration</span>
              <span className={styles.switchDesc}>
                Register a new namespace by computing a Verifiable Delay Function (VDF) proof. This may take several minutes depending on your CPU.
              </span>
            </div>
          </div>

          <div style={{ marginTop: '24px' }}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Namespace (e.g. alice.kin)</label>
              <input
                type="text"
                className="input input-mono"
                placeholder="alice.kin"
                value={registerName}
                onChange={e => setRegisterName(e.target.value)}
                disabled={!!taskId}
                style={{ width: '100%' }}
              />
            </div>
            
            {iterations !== null && !taskId && (
              <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--ink-muted)' }}>
                <strong>VDF Difficulty:</strong> {iterations.time ? `~${iterations.time} seconds` : 'Calculating CPU bound...'} <span style={{ opacity: 0.7 }}>({iterations.count.toLocaleString()} iterations)</span>
              </div>
            )}
            
            <div style={{ marginTop: '24px' }}>
              {taskId ? (
                <VdfProgress progress={progress} />
              ) : (
                <button
                  className="btn-primary"
                  onClick={startRegistration}
                  disabled={!registerName}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Start Registration
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
,
    document.body
  );
}
