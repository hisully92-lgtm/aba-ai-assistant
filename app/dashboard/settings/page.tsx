"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("account");

  return (
    <div className="bg-white rounded-2xl shadow p-6 border">
      <h2 className="text-2xl font-bold mb-2">
        Profile / Settings
      </h2>

      <p className="text-gray-600 mb-6">
        Manage account and workspace settings.
      </p>

      <div className="border rounded-xl overflow-hidden">

        {/* Tabs */}
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

      {/* CONTENT AREA */}
      <div className="mt-6 border rounded-xl p-4 bg-gray-50">

        {activeTab === "account" && (
          <p className="text-gray-600">
            Account settings will include email, password, and authentication preferences.
          </p>
        )}

        {activeTab === "profile" && (
          <p className="text-gray-600">
            Profile settings will include name, role, and organization details.
          </p>
        )}

        {activeTab === "logout" && (
          <p className="text-gray-600">
            Logout confirmation will be handled with Supabase auth sign-out.
          </p>
        )}

      </div>
    </div>
  );
}