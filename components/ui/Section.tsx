type SectionProps = {
  title?: string;
  children: React.ReactNode;
  className?: string;
};

export default function Section({ title, children, className = "" }: SectionProps) {
  return (
    <div className={`bg-white rounded-xl shadow-sm p-4 md:p-6 border border-gray-100 mb-4 md:mb-6 ${className}`}>
      {title && (
        <h2 className="text-base md:text-lg font-bold mb-3 md:mb-4 text-gray-800">
          {title}
        </h2>
      )}
      {children}
    </div>
  );
}