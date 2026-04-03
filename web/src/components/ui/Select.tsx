import type { SelectHTMLAttributes } from "react";
import "./styles.css";

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="ui-select" {...props} />;
}
