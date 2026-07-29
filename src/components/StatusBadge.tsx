type StatusType = "published" | "pending" | "expiring" | "error" | "running" | "offline";

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
}

const CONFIG: Record<StatusType, { label: string; bg: string; color: string }> = {
  published: { label: "Published",  bg: "var(--status-ok-soft)",      color: "var(--status-ok)"      },
  pending:   { label: "Pending",    bg: "var(--status-pending-soft)", color: "var(--status-pending)" },
  expiring:  { label: "Expiring",   bg: "var(--status-warn-soft)",    color: "var(--status-warn)"    },
  error:     { label: "Error",      bg: "var(--status-err-soft)",     color: "var(--status-err)"     },
  running:   { label: "Running",    bg: "var(--amber-soft)",          color: "var(--amber)"          },
  offline:   { label: "Offline",    bg: "var(--bg-muted)",            color: "var(--ink-muted)"      },
};

export default function StatusBadge({ status, label }: StatusBadgeProps) {
  const cfg = CONFIG[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "2px 8px",
        borderRadius: "var(--r-sm)",
        background: cfg.bg,
        color: cfg.color,
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-2xs)",
        fontWeight: 500,
        letterSpacing: "0.04em",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: cfg.color,
          flexShrink: 0,
        }}
      />
      {label ?? cfg.label}
    </span>
  );
}
