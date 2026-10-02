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
        gap: "6px",
        color: "var(--ink-secondary)", /* Soft text instead of colored text */
        fontFamily: "var(--font-sans)", /* Match layout font */
        fontSize: "var(--text-xs)",
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: cfg.color,
          flexShrink: 0,
        }}
      />
      {label ?? cfg.label}
    </span>
  );
}
