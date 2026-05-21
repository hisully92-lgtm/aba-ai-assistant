"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function SettingsPage() {
  const [activeTab, setActiveTab] =
    useState<"account" | "profile" | "logout">("account");

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="bg-white rounded-2xl shadow p-6 border">
      <h2 className="text-2xl font-bold mb-2">Profile / Settings</h2>

      <p className="text-gray-600 mb-6">
        Manage account and workspace settings.
      </p>

      <div className="border rounded-xl overflow-hidden">
        <button
          onClick={() => setActiveTab("account")}
          className="w-full text-left p-4 border-b hover:bg-gray-50 font-medium"
        >
          Account Settings
        </button>

        <button
          onClick={() => setActiveTab("profile")}
          className="w-full text-left p-4 border-b hover:bg-gray-50 font-medium"
        >
          Profile Settings
        </button>

        <button
          onClick={() => setActiveTab("logout")}
          className="w-full text-left p-4 hover:bg-gray-50 font-medium text-red-600"
        >
          Log Out
        </button>
      </div>

      <div className="mt-6 border rounded-xl p-4 bg-gray-50">
        {activeTab === "account" && (
          <p className="text-gray-600">
            Account settings will include email, password, and auth preferences.
          </p>
        )}

        {activeTab === "profile" && (
          <p className="text-gray-600">
            Profile settings will include name, role, and organization details.
          </p>
        )}

        {activeTab === "logout" && (
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-4 py-2 rounded-lg"
          >
            Confirm Logout
          </button>
        )}
      </div>
    </div>
  );
}