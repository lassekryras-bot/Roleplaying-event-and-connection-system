import type { PropsWithChildren } from "react";
import "./styles.css";

export function Card({ children }: PropsWithChildren) {
  return <section className="ui-card">{children}</section>;
}
