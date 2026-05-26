"use client";
import { useEffect } from "react";
export default function SupervisorRedirect() {
  useEffect(() => { window.location.replace("/dashboard/supervisor"); }, []);
  return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400">Redirecting to supervisor dashboard...</p></div>;
}