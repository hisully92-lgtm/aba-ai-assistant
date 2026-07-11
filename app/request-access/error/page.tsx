import PublicNav from "@/components/layout/PublicNav";

export default function RequestAccessErrorPage() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <PublicNav />
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <div className="text-5xl mb-4">Sorry!</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">This link has expired</h1>
        <p className="text-gray-500 mb-6">
          The link you used is no longer valid. This can happen if it was already used or has expired.
        </p>
        
          href="/request-access"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors"
        >
          Submit a New Request
        </a>
      </div>
    </div>
  );
}
