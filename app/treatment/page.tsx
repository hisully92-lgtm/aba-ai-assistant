"use client";
import { useEffect } from "react";
export default function TreatmentRedirect() {
  useEffect(() => { window.location.href = "/dashboard/treatment-plans"; }, []);
  return null;
}
