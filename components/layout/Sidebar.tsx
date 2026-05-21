"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const navItems = [
  { label: "Session Notes", href: "/dashboard" },
  { label: "Behavior Interventions", href: "/dashboard/behaviors" },
  { label: "Skill Programs", href: "/dashboard/programs" },
  { label: "Clients / Learners", href: "/dashboard/clients" },
  { label: "History", href: "/dashboard/history" },
  { label: "Profile / Settings", href: "/dashboard/settings" },
];

export default function Sidebar() {
  const pathname = usePathname();

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="w-64 min-h-screen bg-[#1a2234] flex flex-col">
      <div className="p-4">
        <Image src="/login-banner.jpg" alt="ABA AI" width={220} height={80} className="rounded-lg mb-2" />
        <h1 className="text-white font-bold text-xl mb-6">ABA AI</h1>
        <nav className="flex flex-col gap-2">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={`px-4 py-2 rounded text-white text-sm font-medium transition-colors ${pathname === item.href ? "bg-[#2a3a54]" : "bg-[#243044] hover:bg-[#2a3a54]"}`}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="mt-auto p-4">
        <button onClick={handleLogout} className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded text-sm font-medium">
          Log out
        </button>
      </div>
    </div>
  );
}