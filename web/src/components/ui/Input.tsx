import React, { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import "./styles.css";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(props, ref) {
  return <input ref={ref} className="ui-field" {...props} />;
});
