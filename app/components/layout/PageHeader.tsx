export default function PageHeader({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-center mb-4">
      <h1 className="text-xl font-bold">{title}</h1>
      {children}
    </div>
  );
}