import { useState, useEffect } from 'react';
import { daemon } from '../api/daemon';
import styles from './AdvancedSettingsModal.module.css';

interface Props {
  onClose: () => void;
}

export default function AdvancedSettingsModal({ onClose }: Props) {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    daemon.getDaemonConfig()
      .then(res => {
        if (res && res.config) {
          setConfig(res.config);
        } else {
          console.error("Invalid config response", res);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (section: string, field: string, value: any) => {
    setConfig((prev: any) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleSaveClick = async () => {
    // 1. Check for running VDF tasks
    try {
      // In a real app we'd call a global active VDF endpoint.
      // Assuming a hypothetical check or if we just want to warn the user generally.
      // Wait, earlier we discussed checking a specific endpoint. 
      // Since we don't have a global VDF check, we can always show a caution if a VDF is likely running, 
      // or we just save and show the restart banner.
      // We discussed: "Never auto restart on save. Show a banner."
      
      setSaving(true);
      const res = await daemon.setDaemonConfig(config);
      if (res.status === 'ok') {
        setSaveMessage("Configuration saved. Changes will take effect on the next restart.");
      } else {
        alert(res.message);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save configuration.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.overlay}>
        <div className={styles.modal}>
          <div className={styles.content}>Loading configuration...</div>
        </div>
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        
        {saveMessage && (
          <div className={styles.banner}>
            <span>⚠️ {saveMessage}</span>
            <button onClick={() => setSaveMessage(null)} style={{background:'none', border:'none', color:'white', cursor:'pointer'}}>✕</button>
          </div>
        )}

        <div className={styles.header}>
          <h2 className={styles.title}>Advanced Configuration</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.content}>
          {/* DAEMON SECTION */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>Daemon Settings</h3>
            
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <span className={styles.label}>Network Mode</span>
                <span className={styles.desc}>FullNode stores DHT records; LightNode only queries.</span>
              </div>
              <select 
                className={styles.input} 
                value={config.daemon?.network_mode || 'FullNode'} 
                onChange={e => handleChange('daemon', 'network_mode', e.target.value)}
              >
                <option value="FullNode">FullNode</option>
                <option value="LightNode">LightNode</option>
              </select>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <span className={styles.label}>API Port</span>
                <span className={styles.desc}>Authenticated HTTP API port.</span>
              </div>
              <input 
                type="number" 
                className={styles.input} 
                value={config.daemon?.api_port || 16002}
                onChange={e => handleChange('daemon', 'api_port', parseInt(e.target.value))}
              />
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <span className={styles.label}>NRS Resolver Port</span>
                <span className={styles.desc}>Built-in UDP DNS resolver port (usually 53).</span>
              </div>
              <input 
                type="number" 
                className={styles.input} 
                value={config.daemon?.nrs_port || 53}
                onChange={e => handleChange('daemon', 'nrs_port', parseInt(e.target.value))}
              />
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <span className={styles.label}>Enable NRS</span>
                <span className={styles.desc}>Start the DNS resolver on boot.</span>
              </div>
              <label className={styles.switch}>
                <input 
                  type="checkbox" 
                  checked={config.daemon?.enable_nrs ?? true}
                  onChange={e => handleChange('daemon', 'enable_nrs', e.target.checked)}
                />
                <span className={styles.slider}></span>
              </label>
            </div>
          </div>

          {/* NETWORK SECTION */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>P2P Network</h3>
            
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <span className={styles.label}>Daemon P2P Port</span>
                <span className={styles.desc}>Listen port for swarm connections.</span>
              </div>
              <input 
                type="number" 
                className={styles.input} 
                value={config.network?.daemon_port || 6070}
                onChange={e => handleChange('network', 'daemon_port', parseInt(e.target.value))}
              />
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <span className={styles.label}>Enable mDNS</span>
                <span className={styles.desc}>Discover peers automatically on local network.</span>
              </div>
              <label className={styles.switch}>
                <input 
                  type="checkbox" 
                  checked={config.network?.enable_mdns ?? true}
                  onChange={e => handleChange('network', 'enable_mdns', e.target.checked)}
                />
                <span className={styles.slider}></span>
              </label>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <span className={styles.label}>Enable UPnP</span>
                <span className={styles.desc}>Automatic port forwarding.</span>
              </div>
              <label className={styles.switch}>
                <input 
                  type="checkbox" 
                  checked={config.network?.enable_upnp ?? true}
                  onChange={e => handleChange('network', 'enable_upnp', e.target.checked)}
                />
                <span className={styles.slider}></span>
              </label>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <span className={styles.desc}>Restart required after saving.</span>
          <button className="btn-primary" onClick={handleSaveClick} disabled={saving}>
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}
