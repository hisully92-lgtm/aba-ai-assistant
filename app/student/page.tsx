"use client";

import { useEffect } from "react";
import { requireRole } from "@/lib/requireRole";

export default function StudentPage() {
  useEffect(() => {
    requireRole(["admin", "supervisor", "student_analyst"]);
  }, []);

  return <h1>Student Analyst Dashboard</h1>;
}