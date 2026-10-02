import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import TopBar from './components/TopBar'
import WindowResizer from './components/WindowResizer'
import Dashboard from './pages/Dashboard'
import Names from './pages/Names'
import Nrs from './pages/Nrs'
import Network from './pages/Network'
import Kid from './pages/Kid'
import Settings from './pages/Settings'
import { daemon } from './api/daemon'
import { Toaster } from 'sonner'
import './styles/global.css'

const PageTransition = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 4, filter: 'blur(2px)' }}
    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
    exit={{ opacity: 0, filter: 'blur(2px)' }}
    transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1.0] }}
    style={{ height: '100%' }}
  >
    {children}
  </motion.div>
);

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
      <Toaster position="bottom-right" theme="light" richColors toastOptions={{ style: { fontFamily: 'var(--font-sans)', borderRadius: 'var(--r-md)', padding: '16px', border: '1px solid var(--border)' } }} />
      <WindowResizer />
      {/* Hide top bar navigation if they are stuck on onboarding */}
      <TopBar hideNav={location.pathname === '/identity'} />
      <main style={{ paddingTop: 'var(--pill-offset)', height: '100dvh', overflowY: 'auto' }}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/"         element={<PageTransition><Dashboard /></PageTransition>} />
            <Route path="/names"    element={<PageTransition><Names /></PageTransition>} />
            <Route path="/nrs"      element={<PageTransition><Nrs /></PageTransition>} />
            <Route path="/network"  element={<PageTransition><Network /></PageTransition>} />
            <Route path="/kid"      element={<PageTransition><Kid /></PageTransition>} />
            <Route path="/settings" element={<PageTransition><Settings /></PageTransition>} />
          </Routes>
        </AnimatePresence>
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
