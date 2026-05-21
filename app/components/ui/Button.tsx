import { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export default function Button({
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      style={{
        padding: "10px 16px",
        borderRadius: 8,
        border: "none",
        cursor: "pointer",
        backgroundColor: "#111827",
        color: "white",
        fontWeight: 600,
      }}
    >
      {children}
    </button>
  );
}