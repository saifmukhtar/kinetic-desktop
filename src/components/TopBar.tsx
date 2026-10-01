import { useRef, useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { KineticMark, IconDashboard, IconNames, IconNrs, IconNetwork, IconKid, IconSettings, IconIdentity } from "./Icons";
import { daemon } from "../api/daemon";
import styles from "./TopBar.module.css";

const NAV_ITEMS = [
  { path: "/",         label: "Dashboard", Icon: IconDashboard },
  { path: "/names",    label: "Names",     Icon: IconNames     },
  { path: "/nrs",      label: "NRS",       Icon: IconNrs       },
  { path: "/network",  label: "Network",   Icon: IconNetwork   },
  { path: "/kid",      label: "KID",       Icon: IconKid       },
  { path: "/identity", label: "Identity",  Icon: IconIdentity  },
  { path: "/settings", label: "Settings",  Icon: IconSettings  },
];

export default function TopBar() {
  const location = useLocation();
  const pillRef  = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<Map<string, HTMLAnchorElement | null>>(new Map());
  const [hovered, setHovered] = useState<string | null>(null);
  const [bubbleTarget, setBubbleTarget] = useState({ left: 0, width: 0 });
  const [daemonOnline, setDaemonOnline] = useState<boolean | null>(null);
  const [showNetworkMenu, setShowNetworkMenu] = useState(false);
  const [networks, setNetworks] = useState<any[]>([]);
  const [activeNetworkId, setActiveNetworkId] = useState<string>("kinetic-mainnet");

  const appWindow = getCurrentWindow();

  // Which path drives the bubble — hover takes priority over active
  const activePath = NAV_ITEMS.find((n) =>
    n.path === "/" ? location.pathname === "/" : location.pathname.startsWith(n.path)
  )?.path ?? "/";

  const targetPath = hovered ?? activePath;

  // Measure bubble position
  useEffect(() => {
    function measure() {
      const el        = linkRefs.current.get(targetPath);
      const container = pillRef.current;
      if (!el || !container) return;
      const cRect = container.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();
      setBubbleTarget({ left: eRect.left - cRect.left, width: eRect.width });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [targetPath]);

  // Poll daemon health every 5 seconds
  useEffect(() => {
    async function check() {
      try {
        await daemon.getHealth();
        setDaemonOnline(true);
      } catch {
        setDaemonOnline(false);
      }
    }
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, []);

  // Fetch Atlas networks on mount to populate dropdown
  useEffect(() => {
    daemon.getAtlasNetworks().then(setNetworks).catch(console.error);
    daemon.getActiveEndpoint().then((ep) => setActiveNetworkId(ep.network_id)).catch(console.error);
  }, []);

  const handleSelectNetwork = async (net: any) => {
    setShowNetworkMenu(false);
    try {
      if (!net.local_bind_ip || !net.api_port) throw new Error("Invalid network: missing IP or Port in Atlas configuration");
      await daemon.setActiveEndpoint(net.local_bind_ip, net.api_port, net.network_id);
      setActiveNetworkId(net.network_id);
      // Hard reload to flush all contexts and immediately reconnect to the new daemon
      window.location.reload();
    } catch (e) {
      console.error("Failed to switch network:", e);
    }
  };

  // Find the active network label
  const activeNet = networks.find((n) => n.network_id === activeNetworkId);
  const networkLabel = activeNet ? activeNet.name || activeNet.tld : "Connecting…";

  return (
    <header 
      className={styles.topbar} 
      data-tauri-drag-region 
    >
      {/* ── Logo ── */}
      <NavLink to="/" className={styles.logo}>
        <div className={styles.logoMark}>
          <KineticMark size={16} color="var(--bg-base)" />
        </div>
        <span className={styles.logoName}>Kinetic</span>
      </NavLink>

      {/* ── Network Switcher Dropdown ── */}
      <div className={styles.networkSwitcher}>
        <div 
          className={styles.networkToggle}
          onClick={() => setShowNetworkMenu(!showNetworkMenu)}
        >
          <span
            className={styles.daemonDot}
            data-online={daemonOnline === true}
            data-offline={daemonOnline === false}
          />
          <span className={styles.daemonLabel}>
            {networkLabel}
          </span>
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ opacity: 0.5, marginLeft: 4 }}>
            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        {showNetworkMenu && (
          <div className={styles.networkMenu}>
            {networks.map((net) => (
              <div 
                key={net.network_id}
                className={styles.networkItem}
                data-active={net.network_id === activeNetworkId}
                onClick={() => handleSelectNetwork(net)}
              >
                <div style={{ flex: 1 }}>{net.name || net.tld}</div>
                {net.network_id === activeNetworkId && (
                  <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                    <path d="M1 5L5 9L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Drag spacer — the actual blank zone KDE/macOS/Windows drag from ── */}
      <div className={styles.dragSpacer} data-tauri-drag-region />

      {/* ── Pill navigation ── */}
      <nav
        className={styles.pill}
        ref={pillRef}
        onMouseLeave={() => setHovered(null)}
      >
        {/* Sliding Framer Motion bubble */}
        <motion.div
          className={styles.bubble}
          animate={{ left: bubbleTarget.left, width: bubbleTarget.width }}
          transition={{ type: "spring", stiffness: 500, damping: 35, mass: 0.6 }}
          style={{ position: "absolute", top: 3, bottom: 3 }}
        />

        {NAV_ITEMS.map(({ path, label, Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === "/"}
            ref={(el) => { linkRefs.current.set(path, el); }}
            className={({ isActive }) =>
              `${styles.pillLink} ${isActive ? styles.pillLinkActive : ""}`
            }
            onMouseEnter={() => setHovered(path)}
          >
            <Icon size={13} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* ── Window Controls ── */}
      <div className={styles.windowControls}>
        <div className={styles.windowBtn} data-action="minimize" onClick={async () => {
          try { await appWindow.minimize(); } catch(e) { console.error(e); }
        }}>
          <svg viewBox="0 0 12 2" width="12" height="2" fill="none">
            <path d="M1 1h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
          </svg>
        </div>
        <div className={styles.windowBtn} data-action="maximize" onClick={async () => {
          try { await appWindow.toggleMaximize(); } catch(e) { console.error(e); }
        }}>
          <svg viewBox="0 0 12 12" width="12" height="12" fill="none">
            <rect x="1" y="1" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className={`${styles.windowBtn} ${styles.windowBtnClose}`} data-action="close" onClick={async () => {
          try { await appWindow.close(); } catch(e) { console.error(e); }
        }}>
          <svg viewBox="0 0 12 12" width="12" height="12" fill="none">
            <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
          </svg>
        </div>
      </div>
    </header>
  );
}
