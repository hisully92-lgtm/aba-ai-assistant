"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function PublicNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 px-6 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <span className="font-bold text-gray-900 text-lg">ABA AI</span>
        </Link>

        <div className="flex items-center gap-6">
          <div className="hidden sm:flex items-center gap-5">
            <Link href="/#features" className={`text-sm font-medium transition-colors ${pathname === "/" ? "text-gray-600 hover:text-gray-900" : "text-gray-500 hover:text-gray-800"}`}>
              Features
            </Link>
            <Link href="/pricing" className={`text-sm font-medium transition-colors ${pathname === "/pricing" ? "text-blue-600" : "text-gray-500 hover:text-gray-800"}`}>
              Pricing
            </Link>
            <Link href="/about" className={`text-sm font-medium transition-colors ${pathname === "/about" ? "text-blue-600" : "text-gray-500 hover:text-gray-800"}`}>
              About
            </Link>
            <Link href="/contact" className={`text-sm font-medium transition-colors ${pathname === "/contact" ? "text-blue-600" : "text-gray-500 hover:text-gray-800"}`}>
              Contact
            </Link>
          </div>
          <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
            Sign In
          </Link>
          <Link href="/request-access" className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
            Request Access
          </Link>
        </div>
      </div>
    </nav>
  );
}


