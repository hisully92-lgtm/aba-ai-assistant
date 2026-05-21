type SectionProps = {
  title?: string;
  children: React.ReactNode;
};

export default function Section({ title, children }: SectionProps) {
  return (
    <div className="bg-white rounded-2xl shadow p-6 border mb-6">
      {title && (
        <h2 className="text-xl font-bold mb-4">
          {title}
        </h2>
      )}

      {children}
    </div>
  );
}