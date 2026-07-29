import { useRef, useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { KineticMark, IconDashboard, IconNames, IconDns, IconNetwork, IconKid, IconForge, IconSettings } from "./Icons";
import { daemon } from "../api/daemon";
import styles from "./TopBar.module.css";

const NAV_ITEMS = [
  { path: "/",         label: "Dashboard", Icon: IconDashboard },
  { path: "/names",    label: "Names",     Icon: IconNames     },
  { path: "/dns",      label: "DNS",       Icon: IconDns       },
  { path: "/network",  label: "Network",   Icon: IconNetwork   },
  { path: "/kid",      label: "KID",       Icon: IconKid       },
  { path: "/forge",    label: "Forge",     Icon: IconForge     },
  { path: "/settings", label: "Settings",  Icon: IconSettings  },
];

export default function TopBar() {
  const location = useLocation();
  const pillRef  = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<Map<string, HTMLAnchorElement | null>>(new Map());
  const [hovered, setHovered] = useState<string | null>(null);
  const [bubbleTarget, setBubbleTarget] = useState({ left: 0, width: 0 });
  const [daemonOnline, setDaemonOnline] = useState<boolean | null>(null);

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

  return (
    <header className={styles.topbar}>
      {/* ── Logo ── */}
      <NavLink to="/" className={styles.logo}>
        <div className={styles.logoMark}>
          <KineticMark size={16} color="var(--bg-base)" />
        </div>
        <span className={styles.logoName}>Kinetic</span>
      </NavLink>

      {/* ── Daemon status dot ── */}
      <div className={styles.daemonStatus}>
        <span
          className={styles.daemonDot}
          data-online={daemonOnline === true}
          data-offline={daemonOnline === false}
        />
        <span className={styles.daemonLabel}>
          {daemonOnline === null ? "Connecting…" : daemonOnline ? "Running" : "Daemon Offline"}
        </span>
      </div>

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
    </header>
  );
}
