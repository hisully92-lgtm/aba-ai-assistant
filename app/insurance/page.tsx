"use client";
import { useEffect } from "react";
export default function InsuranceRedirect() {
  useEffect(() => { window.location.replace("/dashboard/insurance"); }, []);
  return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400">Redirecting to insurance...</p></div>;
}