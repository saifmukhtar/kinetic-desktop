import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { daemon } from '../api/daemon';
import { toast } from 'sonner';

export default function Installer() {
  const navigate = useNavigate();
  const [installing, setInstalling] = useState(false);
  const [step, setStep] = useState('Ready to install');

  const handleInstall = async () => {
    setInstalling(true);
    try {
      setStep('Extracting binaries...');
      await daemon.extractBundledBinaries();

      setStep('Requesting privileges (Please enter your password)...');
      // This will trigger pkexec/osascript/powershell and install the daemon
      await daemon.installBinaries('desktop');

      toast.success('Kinetic Daemon successfully installed and started!');
      
      // The installer script automatically runs `kinetic seed init`.
      // So the identity is actually already generated!
      // We'll navigate back to root, which will re-run the identity check.
      // If it wants them to back up the seed, it can be done later, but for now they are installed.
      navigate('/');
    } catch (err: any) {
      toast.error('Installation failed: ' + err.toString());
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div style={{
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100%', 
      width: '100%',
      background: 'radial-gradient(circle at center, var(--surface) 0%, var(--bg) 100%)',
      padding: '24px'
    }}>
      <div style={{
        background: 'var(--surface-raised)',
        padding: '32px',
        borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border)',
        maxWidth: '480px',
        textAlign: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
      }}>
        <h1 style={{ marginBottom: '16px', fontSize: '24px', fontWeight: 600 }}>Welcome to Kinetic</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '32px', lineHeight: 1.5 }}>
          The Kinetic Desktop acts as a control center for the underlying <strong>Kinetic Engine</strong>.
          Before you can connect to the network, we need to install the engine as a background system service.
        </p>

        {installing ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div className="spinner" style={{ width: '32px', height: '32px', border: '3px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontWeight: 500 }}>{step}</span>
            <style>{`
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
          </div>
        ) : (
          <button className="btn-primary" style={{ width: '100%', padding: '12px' }} onClick={handleInstall}>
            Install Kinetic Engine
          </button>
        )}
      </div>
    </div>
  );
}
