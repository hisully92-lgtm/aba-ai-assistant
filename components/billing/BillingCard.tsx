"use client";

import Link from "next/link";
import { usePlan } from "@/lib/billing/usePlan";

export default function BillingCard() {
  const { plan, loading } = usePlan();

  if (loading) return <div>Loading billing...</div>;

  return (
    <div className="p-6 border rounded-lg">
      <h2 className="text-xl font-bold">Billing</h2>

      <p className="mt-2">
        Current plan:{" "}
        <span className="font-semibold">
          {plan.toUpperCase()}
        </span>
      </p>

      {plan === "free" ? (
        <Link href="/dashboard/upgrade">
          <button className="mt-4 px-4 py-2 bg-black text-white rounded">
            Upgrade to Pro
          </button>
        </Link>
      ) : (
        <p className="mt-4 text-green-600">
          You are on Pro 🎉
        </p>
      )}
    </div>
  );
}