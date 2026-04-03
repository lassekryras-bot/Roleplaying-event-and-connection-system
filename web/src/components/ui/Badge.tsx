import type { PropsWithChildren } from "react";
import "./styles.css";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

export function Badge({ tone = "neutral", children }: PropsWithChildren<{ tone?: BadgeTone }>) {
  return <span className={`ui-badge ui-badge--${tone}`}>{children}</span>;
}
