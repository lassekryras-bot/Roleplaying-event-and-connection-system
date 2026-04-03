import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import "./styles.css";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
  }
>;

export function Button({ variant = "secondary", className = "", children, ...props }: ButtonProps) {
  const resolved = variant === "secondary" ? "" : `ui-button--${variant}`;
  return (
    <button className={`ui-button ${resolved} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
