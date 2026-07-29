import styles from "./StatCard.module.css";

interface StatCardProps {
  eyebrow: string;
  value: string | number;
  label: string;
  accent?: boolean;
}

export default function StatCard({ eyebrow, value, label, accent }: StatCardProps) {
  return (
    <div className={`${styles.card} ${accent ? styles.accent : ""}`}>
      {/* Amber accent bar across top */}
      <div className={styles.accentBar} />
      <div className={styles.body}>
        <span className={`eyebrow ${styles.eyebrow}`}>{eyebrow}</span>
        <span className={`display ${styles.value}`}>{value}</span>
        <span className={styles.label}>{label}</span>
      </div>
    </div>
  );
}
