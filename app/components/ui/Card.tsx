import { ReactNode } from "react";

export default function Card({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 20,
        backgroundColor: "white",
        boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
      }}
    >
      {children}
    </div>
  );
}