/**
 * Kinetic Desktop — Custom SVG Icon Set
 * Geometric marks designed for the Kinetic brand.
 * NOT Lucide, NOT Heroicons. Every icon is bespoke.
 */

interface IconProps {
  size?: number;
  color?: string;
  className?: string;
}

const defaults = { size: 16, color: "currentColor" };

// ── K — The Kinetic Logo Mark ────────────────────────────────────────────────
// A geometric amber "K" built from two diagonal strokes off a vertical bar
export function KineticMark({ size = 22, color = "currentColor", className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" className={className}>
      {/* Vertical spine */}
      <rect x="4" y="3" width="2.5" height="16" rx="1" fill={color} />
      {/* Upper diagonal — top-right */}
      <path d="M6.5 11 L17 3.5" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {/* Lower diagonal — bottom-right */}
      <path d="M6.5 11 L17 18.5" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Dashboard — four small squares in a grid ─────────────────────────────────
export function IconDashboard({ size = defaults.size, color = defaults.color, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" stroke={color} strokeWidth="1.4" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" stroke={color} strokeWidth="1.4" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" stroke={color} strokeWidth="1.4" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1" stroke={color} strokeWidth="1.4" />
    </svg>
  );
}

// ── Names — a rounded label tag with a dot ───────────────────────────────────
export function IconNames({ size = defaults.size, color = defaults.color, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path
        d="M1.5 4.5C1.5 3.4 2.4 2.5 3.5 2.5H9.5L14.5 7.5V11.5C14.5 12.6 13.6 13.5 12.5 13.5H3.5C2.4 13.5 1.5 12.6 1.5 11.5V4.5Z"
        stroke={color}
        strokeWidth="1.4"
      />
      <circle cx="5" cy="8" r="1.2" fill={color} />
    </svg>
  );
}

// ── DNS — two nodes connected by a line (network record) ─────────────────────
export function IconNrs({ size = defaults.size, color = defaults.color, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="3" cy="8" r="2" stroke={color} strokeWidth="1.4" />
      <circle cx="13" cy="8" r="2" stroke={color} strokeWidth="1.4" />
      <line x1="5" y1="8" x2="11" y2="8" stroke={color} strokeWidth="1.4" strokeDasharray="2 1.5" />
      <line x1="8" y1="3" x2="8" y2="13" stroke={color} strokeWidth="1.4" strokeDasharray="2 1.5" />
    </svg>
  );
}

// ── Network — three circles with connecting lines (peer topology) ─────────────
export function IconNetwork({ size = defaults.size, color = defaults.color, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="3.5" r="2" stroke={color} strokeWidth="1.4" />
      <circle cx="2.5" cy="12.5" r="2" stroke={color} strokeWidth="1.4" />
      <circle cx="13.5" cy="12.5" r="2" stroke={color} strokeWidth="1.4" />
      <line x1="6.7" y1="5" x2="3.7" y2="11" stroke={color} strokeWidth="1.4" />
      <line x1="9.3" y1="5" x2="12.3" y2="11" stroke={color} strokeWidth="1.4" />
      <line x1="4.5" y1="12.5" x2="11.5" y2="12.5" stroke={color} strokeWidth="1.4" />
    </svg>
  );
}

// ── KID — a key shape ────────────────────────────────────────────────────────
export function IconKid({ size = defaults.size, color = defaults.color, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="5.5" cy="7" r="3" stroke={color} strokeWidth="1.4" />
      <path d="M8 8.5L14 14" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M11.5 12 L11.5 14" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M13 11 L13 13" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}



// ── Identity — a shield shape ────────────────────────────────────────────────
export function IconIdentity({ size = defaults.size, color = defaults.color, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 2L3 4V8C3 11 5.5 13.5 8 15C10.5 13.5 13 11 13 8V4L8 2Z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

// ── Forge — an anvil-like shape (creation / minting) ─────────────────────────
export function IconForge({ size = defaults.size, color = defaults.color, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      {/* Anvil top */}
      <rect x="2" y="4" width="12" height="5" rx="1.5" stroke={color} strokeWidth="1.4" />
      {/* Anvil base */}
      <rect x="4.5" y="9" width="7" height="3" rx="1" stroke={color} strokeWidth="1.4" />
      {/* Horn */}
      <path d="M14 6.5 L16 5 L16 8 Z" fill={color} />
    </svg>
  );
}

// ── Settings — two horizontal sliders ────────────────────────────────────────
export function IconSettings({ size = defaults.size, color = defaults.color, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <line x1="1.5" y1="5" x2="14.5" y2="5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="5" cy="5" r="1.8" fill="var(--bg-base)" stroke={color} strokeWidth="1.4" />
      <line x1="1.5" y1="11" x2="14.5" y2="11" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="11" cy="11" r="1.8" fill="var(--bg-base)" stroke={color} strokeWidth="1.4" />
    </svg>
  );
}

// ── Copy — two overlapping squares ───────────────────────────────────────────
export function IconCopy({ size = defaults.size, color = defaults.color, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="5" y="5" width="9" height="9" rx="1" stroke={color} strokeWidth="1.4" />
      <path d="M3 11H2C1.4 11 1 10.6 1 10V2C1 1.4 1.4 1 2 1H10C10.6 1 11 1.4 11 2V3" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// ── Check mark ───────────────────────────────────────────────────────────────
export function IconCheck({ size = defaults.size, color = defaults.color, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2.5 8 L6.5 12 L13.5 4" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Plus ─────────────────────────────────────────────────────────────────────
export function IconPlus({ size = defaults.size, color = defaults.color, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <line x1="8" y1="2" x2="8" y2="14" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <line x1="2" y1="8" x2="14" y2="8" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// ── Trash ────────────────────────────────────────────────────────────────────
export function IconTrash({ size = defaults.size, color = defaults.color, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 4H14" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M5 4V2.5C5 2.2 5.2 2 5.5 2H10.5C10.8 2 11 2.2 11 2.5V4" stroke={color} strokeWidth="1.4" />
      <path d="M3 4L3.8 13.5C3.9 13.8 4.1 14 4.5 14H11.5C11.9 14 12.1 13.8 12.2 13.5L13 4" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// ── Arrow right ──────────────────────────────────────────────────────────────
export function IconArrow({ size = defaults.size, color = defaults.color, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 8H13" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9 4L13 8L9 12" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Refresh ───────────────────────────────────────────────────────────────────
export function IconRefresh({ size = defaults.size, color = defaults.color, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M13.5 2.5V6.5H9.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.3 6.5C12.4 3.9 9.7 2.3 6.9 2.9C4.1 3.5 2.3 6.1 2.5 8.9C2.7 11.8 5 14 7.8 14C10.2 14 12.3 12.3 13 10" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// ── Help / Info ──────────────────────────────────────────────────────────────
export function IconHelp({ size = defaults.size, color = defaults.color, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.4" />
      <path d="M6.5 6.5C6.5 5.5 7.2 4.8 8 4.8C8.8 4.8 9.5 5.5 9.5 6.2C9.5 7.2 8 7.5 8 8.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="11.2" r="0.8" fill={color} />
    </svg>
  );
}

export function IconPower({ size = defaults.size, color = defaults.color, className }: IconProps) {
  return (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v10" />
      <path d="M18.4 6.6a9 9 0 1 1-12.77.04" />
    </svg>
  );
}
