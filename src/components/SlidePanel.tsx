import { ReactNode } from 'react';
import styles from './SlidePanel.module.css';

interface SlidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  disableClose?: boolean;
}

export default function SlidePanel({ open, onClose, title, children, disableClose }: SlidePanelProps) {
  return (
    <>
      <div 
        className={`${styles.overlay} ${open ? styles.open : ''}`} 
        onClick={() => !disableClose && onClose()} 
      />
      
      <div className={`${styles.panel} ${open ? styles.open : ''}`}>
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>{title}</h2>
          {!disableClose && (
            <button className={styles.closeBtn} onClick={onClose}>&times;</button>
          )}
        </div>
        
        <div className={styles.panelContent}>
          {children}
        </div>
      </div>
    </>
  );
}
