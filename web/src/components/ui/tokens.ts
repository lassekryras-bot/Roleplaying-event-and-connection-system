export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  xxl: "32px",
} as const;

export const typography = {
  headingLg: {
    fontSize: "28px",
    fontWeight: 700,
    lineHeight: 1.2,
  },
  headingMd: {
    fontSize: "22px",
    fontWeight: 600,
    lineHeight: 1.3,
  },
  bodyMd: {
    fontSize: "15px",
    fontWeight: 400,
    lineHeight: 1.5,
  },
  bodySm: {
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.4,
  },
  label: {
    fontSize: "12px",
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: "0.03em",
    textTransform: "uppercase" as const,
  },
} as const;

export const colors = {
  bg: "#0f1220",
  bgElevated: "#1a2034",
  border: "#2d3550",
  textPrimary: "#edf2ff",
  textMuted: "#a7b2d9",
  info: "#4da3ff",
  success: "#2ec27e",
  warning: "#f5c451",
  danger: "#ff6b6b",
} as const;

export type ThreadState =
  | "draft"
  | "active"
  | "pending"
  | "paused"
  | "archived"
  | "error";

export const threadStateBadgeMap: Record<
  ThreadState,
  { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }
> = {
  draft: { label: "Draft", tone: "neutral" },
  active: { label: "Active", tone: "success" },
  pending: { label: "Pending", tone: "info" },
  paused: { label: "Paused", tone: "warning" },
  archived: { label: "Archived", tone: "neutral" },
  error: { label: "Needs Attention", tone: "danger" },
};
