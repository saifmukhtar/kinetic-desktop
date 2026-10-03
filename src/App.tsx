import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState, lazy, Suspense } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import TopBar from './components/TopBar'
import WindowResizer from './components/WindowResizer'
import { daemon } from './api/daemon'
import { Toaster } from 'sonner'
import './styles/global.css'

// Lazy load routes to massively cut down initial JS bundle size
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Names = lazy(() => import('./pages/Names'));
const Nrs = lazy(() => import('./pages/Nrs'));
const Network = lazy(() => import('./pages/Network'));
const Kid = lazy(() => import('./pages/Kid'));
const Settings = lazy(() => import('./pages/Settings'));
const Identity = lazy(() => import('./pages/Identity'));

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

// Minimal fallback while route chunks load
const PageLoader = () => (
  <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
    <span className="eyebrow" style={{ opacity: 0.5 }}>Loading...</span>
  </div>
);

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    let timer: NodeJS.Timeout | null = null;

    async function checkIdentity() {
      try {
        const res = await daemon.checkIdentityStatus();
        if (!active) return;

        if (res.status !== 'found') {
          if (location.pathname !== '/identity') {
            navigate('/identity');
          }
          // Poll again since user is onboarding
          timer = setTimeout(checkIdentity, 2000);
        } else {
          // Found! Stop polling permanently to save CPU and battery
          if (timer) clearTimeout(timer);
        }
      } catch (err) {
        // Daemon offline / starting up. Poll less aggressively
        if (active) timer = setTimeout(checkIdentity, 5000);
      } finally {
        if (active) setChecking(false);
      }
    }
    
    checkIdentity();
    
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
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
          <Suspense fallback={<PageLoader />}>
            <Routes location={location} key={location.pathname}>
              <Route path="/"         element={<PageTransition><Dashboard /></PageTransition>} />
              <Route path="/names"    element={<PageTransition><Names /></PageTransition>} />
              <Route path="/nrs"      element={<PageTransition><Nrs /></PageTransition>} />
              <Route path="/network"  element={<PageTransition><Network /></PageTransition>} />
              <Route path="/kid"      element={<PageTransition><Kid /></PageTransition>} />
              <Route path="/settings" element={<PageTransition><Settings /></PageTransition>} />
              <Route path="/identity" element={<PageTransition><Identity /></PageTransition>} />
            </Routes>
          </Suspense>
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
