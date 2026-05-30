"use client";
import { useEffect } from "react";
export default function ProgressReportRedirect() {
  useEffect(() => { window.location.href = "/dashboard/progress-reports"; }, []);
  return null;
}
