export default function DashboardLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 bg-gray-200 rounded-xl w-48 animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />
        ))}
      </div>
      <div className="h-40 bg-gray-200 rounded-xl animate-pulse" />
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-200 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}