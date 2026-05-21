import { ReactNode } from "react";

interface SectionProps {
  title?: string;
  children: ReactNode;
}

export default function Section({
  title,
  children,
}: SectionProps) {
  return (
    <section
      style={{
        marginBottom: 24,
      }}
    >
      {title && (
        <h2
          style={{
            marginBottom: 16,
          }}
        >
          {title}
        </h2>
      )}

      {children}
    </section>
  );
}