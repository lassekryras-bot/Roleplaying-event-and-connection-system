import type { PropsWithChildren } from "react";
import type { BadgeTone } from "./Badge";
import "./styles.css";

export function Toast({ tone = "info", children }: PropsWithChildren<{ tone?: Exclude<BadgeTone, "neutral"> }>) {
  return <div role="status" className={`ui-toast ui-toast--${tone}`}>{children}</div>;
}
