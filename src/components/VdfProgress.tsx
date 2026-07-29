import styles from './VdfProgress.module.css';

interface VdfProgressProps {
  progress: number;
}

export default function VdfProgress({ progress }: VdfProgressProps) {
  return (
    <div className={styles.progressContainer}>
      <span>Calculating VDF proof... {Math.round(progress)}%</span>
      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
