import type { InputHTMLAttributes } from "react";
import "./styles.css";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="ui-field" {...props} />;
}
