"use client";
import { useEffect } from "react";
export default function TreatmentRedirect() {
  useEffect(() => { window.location.replace("/dashboard/treatment-plans"); }, []);
  return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400">Redirecting to treatment plans...</p></div>;
}