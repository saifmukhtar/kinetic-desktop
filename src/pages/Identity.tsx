import IdentityModal from '../components/IdentityModal';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { daemon } from '../api/daemon';

export default function Identity() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  // When IdentityModal finishes its job, it calls onClose.
  // We should navigate to the dashboard when it finishes.
  const handleClose = async () => {
    try {
      const res = await daemon.checkIdentityStatus();
      if (res.status === 'found') {
        navigate('/');
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    // Failsafe: if they manually went to /identity but already have one, kick them to dashboard
    async function check() {
      try {
        const res = await daemon.checkIdentityStatus();
        if (res.status === 'found') {
          navigate('/');
        }
      } catch (err) {
        // Ignore
      } finally {
        setChecking(false);
      }
    }
    check();
  }, [navigate]);

  if (checking) return null;

  return (
    <div style={{
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100%', 
      width: '100%',
      // Cool gradient background for onboarding!
      background: 'radial-gradient(circle at center, var(--surface) 0%, var(--bg) 100%)'
    }}>
      <IdentityModal onClose={handleClose} />
    </div>
  );
}
