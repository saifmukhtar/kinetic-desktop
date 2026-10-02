import { useState, useEffect } from 'react';
import { daemon } from '../api/daemon';
import StatusBadge from './StatusBadge';
import styles from './IdentityModal.module.css';

type Step = 'status' | 'init_show' | 'init_verify' | 'restore';

interface Props {
  onClose: () => void;
}

export default function IdentityModal({ onClose }: Props) {
  const [step, setStep] = useState<Step>('status');
  const [status, setStatus] = useState<'found' | 'not_found' | 'corrupted' | 'loading'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  // Init state
  const [phrase, setPhrase] = useState('');
  const [phraseWords, setPhraseWords] = useState<string[]>([]);
  const [v1, setV1] = useState(0);
  const [v2, setV2] = useState(0);
  const [input1, setInput1] = useState('');
  const [input2, setInput2] = useState('');

  // Restore state
  const [restoreInput, setRestoreInput] = useState('');

  useEffect(() => {
    checkStatus();
  }, []);

  async function checkStatus() {
    try {
      const res = await daemon.checkIdentityStatus();
      setStatus(res.status);
      if (res.status === 'found') setStep('status');
    } catch (err: any) {
      setErrorMsg(err.toString());
      setStatus('corrupted');
    }
  }

  async function handleStartInit() {
    setErrorMsg('');
    try {
      const res = await daemon.generateSeedPhrase();
      setPhrase(res.phrase);
      setPhraseWords(res.phrase.split(' '));
      setV1(res.verify_index_1);
      setV2(res.verify_index_2);
      setStep('init_show');
    } catch (err: any) {
      setErrorMsg(err.toString());
    }
  }

  function handleContinueVerify() {
    setInput1('');
    setInput2('');
    setErrorMsg('');
    setStep('init_verify');
  }

  async function handleVerify() {
    if (input1.trim() !== phraseWords[v1] || input2.trim() !== phraseWords[v2]) {
      setErrorMsg('Incorrect words. Please check your backup and try again.');
      return;
    }
    await savePhrase(phrase);
  }

  async function handleRestore() {
    const p = restoreInput.trim();
    if (p.split(/\s+/).length !== 24) {
      setErrorMsg('Seed phrase must be exactly 24 words.');
      return;
    }
    await savePhrase(p);
  }

  async function savePhrase(p: string) {
    try {
      await daemon.saveSeedPhrase(p);
      await checkStatus();
      setStep('status');
      setRestoreInput('');
      setPhrase('');
      onClose();
    } catch (err: any) {
      setErrorMsg(err.toString());
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Identity</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.content}>
          {step === 'status' && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Master Identity Key</h2>
              <p className={styles.cardDesc}>
                Your Kinetic master identity is derived from a 24-word seed phrase. 
                This key is used to sign and authorize your KIDs (Kinetic Identity Documents) before they are published to the network.
              </p>

              <div className={styles.statusRow}>
                <span className={styles.statusLabel}>Key Status</span>
                {status === 'loading' && <StatusBadge status="pending" label="Checking..." />}
                {status === 'found' && <StatusBadge status="published" label="Active & Secure" />}
                {status === 'not_found' && <StatusBadge status="offline" label="Not Found" />}
                {status === 'corrupted' && <StatusBadge status="error" label="Corrupted" />}
              </div>

              <div className={styles.buttonGroup}>
                {status !== 'found' && (
                  <button className="btn-primary" onClick={handleStartInit}>
                    Generate New Seed
                  </button>
                )}
                <button className="btn-ghost" onClick={() => setStep('restore')}>
                  Restore from Seed Phrase
                </button>
              </div>
              {errorMsg && <p className={styles.errorText}>{errorMsg}</p>}
            </div>
          )}

          {step === 'init_show' && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>🚨 Backup Your Seed Phrase 🚨</h2>
              <p className={styles.cardDesc}>
                Write down these 24 words and store them safely. This is the only way to recover your master identity. 
                <strong> You will never be able to view this phrase again.</strong>
              </p>

              <div className={styles.phraseGrid}>
                {phraseWords.map((word, i) => (
                  <div key={i} className={styles.phraseWord}>
                    <span className={styles.wordIndex}>{(i + 1).toString().padStart(2, '0')}.</span>
                    <span>{word}</span>
                  </div>
                ))}
              </div>

              <div className={styles.buttonGroup}>
                <button className="btn-primary" onClick={handleContinueVerify}>
                  I've backed it up
                </button>
                <button className="btn-ghost" onClick={() => setStep('status')}>Cancel</button>
              </div>
            </div>
          )}

          {step === 'init_verify' && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Verify Backup</h2>
              <p className={styles.cardDesc}>
                To ensure you have correctly backed up your phrase, please enter the requested words.
              </p>

              <div className={styles.verifyRow}>
                <div className={styles.verifyInputGroup}>
                  <span className={styles.verifyLabel}>Word #{v1 + 1}:</span>
                  <input 
                    type="text" 
                    className={`input ${styles.verifyInput}`} 
                    value={input1} 
                    onChange={e => setInput1(e.target.value)} 
                  />
                </div>
                <div className={styles.verifyInputGroup}>
                  <span className={styles.verifyLabel}>Word #{v2 + 1}:</span>
                  <input 
                    type="text" 
                    className={`input ${styles.verifyInput}`} 
                    value={input2} 
                    onChange={e => setInput2(e.target.value)} 
                  />
                </div>
              </div>

              {errorMsg && <p className={styles.errorText}>{errorMsg}</p>}

              <div className={styles.buttonGroup}>
                <button className="btn-primary" onClick={handleVerify}>Verify & Save Identity</button>
                <button className="btn-ghost" onClick={() => setStep('init_show')}>Back</button>
              </div>
            </div>
          )}

          {step === 'restore' && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Restore Identity</h2>
              <p className={styles.cardDesc}>
                Enter your 24-word seed phrase separated by spaces.
                {status === 'found' && ' WARNING: This will overwrite your current active identity.'}
              </p>

              <textarea 
                className={`input ${styles.restoreBox}`} 
                placeholder="e.g. abandon abandon abandon..."
                value={restoreInput}
                onChange={e => setRestoreInput(e.target.value)}
              />

              {errorMsg && <p className={styles.errorText}>{errorMsg}</p>}

              <div className={styles.buttonGroup}>
                <button className="btn-primary" onClick={handleRestore} disabled={!restoreInput}>
                  Restore Identity
                </button>
                <button className="btn-ghost" onClick={() => setStep('status')}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
