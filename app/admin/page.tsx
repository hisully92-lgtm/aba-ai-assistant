"use client";
import { useEffect } from "react";
export default function AdminRedirect() {
  useEffect(() => { window.location.replace("/dashboard/admin/logs"); }, []);
  return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400">Redirecting to admin panel...</p></div>;
}