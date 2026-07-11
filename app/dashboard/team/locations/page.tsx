"use client";
import { useEffect } from "react";
export default function TeamLocationsRedirect() {
  useEffect(() => { window.location.replace("/dashboard/admin/locations"); }, []);
  return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400">Redirecting...</p></div>;
}
