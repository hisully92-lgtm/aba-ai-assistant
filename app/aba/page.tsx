"use client";
import { useEffect } from "react";
export default function ABARedirect() {
  useEffect(() => { window.location.replace("/"); }, []);
  return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400">Redirecting...</p></div>;
}
