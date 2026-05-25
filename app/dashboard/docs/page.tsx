"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = dynamic<{ spec: any }>(
  () => import("swagger-ui-react"),
  { ssr: false }
);

export default function DocsPage() {
  const [spec, setSpec] = useState<any>(null);

  useEffect(() => {
    fetch("/api/docs")
      .then((res) => res.json())
      .then((data) => setSpec(data));
  }, []);

  if (!spec) {
    return (
      <div className="p-6 text-gray-400">Loading API documentation...</div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-200 px-6 py-4">
        <h1 className="text-xl font-bold text-gray-800">ABA AI Assistant — API Docs</h1>
        <p className="text-sm text-gray-500 mt-1">Interactive API documentation</p>
      </div>
      <SwaggerUI spec={spec} />
    </div>
  );
}