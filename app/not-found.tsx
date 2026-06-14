import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 text-center space-y-6">
        <div className="text-6xl">🔍</div>
        <div>
          <h1 className="text-3xl font-black text-gray-900">404</h1>
          <p className="text-lg font-semibold text-gray-700 mt-1">Page not found</p>
          <p className="text-gray-500 text-sm mt-2">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Link
            href="/dashboard"
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors text-center"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="w-full py-3 border border-gray-200 text-gray-600 rounded-xl font-medium text-sm hover:bg-gray-50 transition-colors text-center"
          >
            Back to Home
          </Link>
          <Link href="/contact" className="text-xs text-blue-500 hover:underline mt-1">
            Report a broken link →
          </Link>
        </div>
      </div>
    </div>
  );
}