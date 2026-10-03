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
const Installer = lazy(() => import('./pages/Installer'));

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

    async function checkSystemState() {
      try {
        // 0. Always ensure the user-owned directory tree exists.
        //    This is idempotent (create_dir_all does nothing if they already exist)
        //    and requires no root. Calling it on every startup guarantees
        //    base_dir / networks_dir / nsp_dir / pac_dir are always owned
        //    by the desktop user before any other logic runs.
        await daemon.setupUserDirs().catch(() => {
          // Non-fatal — if this fails the rest of the checks will surface the real error.
        });

        // 1. Check if the daemon + CLI binaries are actually installed
        const installRes = await daemon.checkInstalled();
        if (!active) return;
        
        if (!installRes.is_installed) {
          if (location.pathname !== '/installer') {
            navigate('/installer');
          }
          if (active) setChecking(false);
          return; // Stop checking identity if not installed
        }

        // 2. If installed, check if they have an identity
        const idRes = await daemon.checkIdentityStatus();
        if (!active) return;

        if (idRes.status !== 'found') {
          if (location.pathname !== '/identity') {
            navigate('/identity');
          }
          timer = setTimeout(checkSystemState, 2000);
        } else {
          // Found identity! We are fully operational.
          if (timer) clearTimeout(timer);
          // If they are stuck on installer/identity pages but are actually set up, redirect home
          if (location.pathname === '/installer' || location.pathname === '/identity') {
            navigate('/');
          }
        }
      } catch (err) {
        // Network/daemon offline. Poll slowly.
        if (active) timer = setTimeout(checkSystemState, 5000);
      } finally {
        if (active) setChecking(false);
      }
    }
    
    checkSystemState();
    
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
      <TopBar hideNav={location.pathname === '/identity' || location.pathname === '/installer'} />
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
              <Route path="/installer" element={<PageTransition><Installer /></PageTransition>} />
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
