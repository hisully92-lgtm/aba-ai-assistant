type PageHeaderProps = {
  title: string;
  children?: React.ReactNode;
  className?: string;
};

export default function PageHeader({ title, children, className = "" }: PageHeaderProps) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <h1 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">
        {title}
      </h1>
      {children && (
        <div className="flex flex-wrap gap-2 items-center">
          {children}
        </div>
      )}
    </div>
  );
}