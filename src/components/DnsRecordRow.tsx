import { DnsRecord } from '../api/daemon';
import { IconTrash } from './Icons';
import styles from './DnsRecordRow.module.css';

interface DnsRecordRowProps {
  record: DnsRecord;
  onTypeChange: (type: DnsRecord['type']) => void;
  onValueChange: (value: string) => void;
  onDelete: () => void;
}

export default function DnsRecordRow({ record, onTypeChange, onValueChange, onDelete }: DnsRecordRowProps) {
  return (
    <div className={styles.recordRow}>
      <div className={styles.recordType}>
        <select 
          className={`input input-mono ${styles.recordTypeSelect}`}
          value={record.type}
          onChange={e => onTypeChange(e.target.value as DnsRecord['type'])}
        >
          <option value="A">A</option>
          <option value="AAAA">AAAA</option>
          <option value="CNAME">CNAME</option>
          <option value="TXT">TXT</option>
          <option value="PeerId">PeerId</option>
          <option value="KID">KID</option>
        </select>
      </div>
      <div className={styles.recordValue}>
        <input
          type="text"
          className="input input-mono"
          value={record.value}
          onChange={e => onValueChange(e.target.value)}
          placeholder="Value..."
        />
      </div>
      <button className="btn-icon" onClick={onDelete}>
        <IconTrash />
      </button>
    </div>
  );
}
