import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import TopBar from './components/TopBar'
import WindowResizer from './components/WindowResizer'
import Dashboard from './pages/Dashboard'
import Names from './pages/Names'
import Nrs from './pages/Nrs'
import Network from './pages/Network'
import Kid from './pages/Kid'
import Identity from './pages/Identity'
import Settings from './pages/Settings'
import { daemon } from './api/daemon'
import './styles/global.css'

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkIdentity() {
      try {
        const res = await daemon.checkIdentityStatus();
        if (res.status !== 'found' && location.pathname !== '/identity') {
          navigate('/identity');
        }
      } catch (err) {
        // Daemon might be starting up
      } finally {
        setChecking(false);
      }
    }
    
    // Periodically check if we need to force onboarding, but only aggressively if not found yet
    checkIdentity();
    const id = setInterval(checkIdentity, 2000);
    return () => clearInterval(id);
  }, [location.pathname, navigate]);

  if (checking) return null;

  return (
    <>
      <WindowResizer />
      {/* Hide top bar navigation if they are stuck on onboarding */}
      <TopBar hideNav={location.pathname === '/identity'} />
      <main style={{ paddingTop: 'var(--pill-offset)', height: '100dvh', overflowY: 'auto' }}>
        <Routes>
          <Route path="/"         element={<Dashboard />} />
          <Route path="/names"    element={<Names />} />
          <Route path="/nrs"      element={<Nrs />} />
          <Route path="/network"  element={<Network />} />
          <Route path="/kid"      element={<Kid />} />
          <Route path="/identity" element={<Identity />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  )
}
