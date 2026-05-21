import React from "react";

type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export default function Card({ children, className }: CardProps) {
  return (
    <div
      className={`border rounded p-4 shadow-sm bg-white ${className ?? ""}`}
    >
      {children}
    </div>
  );
}