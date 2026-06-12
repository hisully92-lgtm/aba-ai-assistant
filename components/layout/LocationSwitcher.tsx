"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Location = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  is_primary: boolean;
};

type Company = {
  id: string;
  name: string;
};

export default function LocationSwitcher() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [activeLocation, setActiveLocation] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id, role, active_location_id")
      .eq("id", user.id)
      .single();

    if (!profile) return;
    setRole(profile.role);

    if (profile.company_id) {
      const { data: companyData } = await supabase
        .from("companies")
        .select("id, name")
        .eq("id", profile.company_id)
        .single();
      setCompany(companyData);
    }

    const { data: assignments } = await supabase
      .from("user_location_assignments")
      .select("location_id, is_primary, company_locations(id, name, city, state)")
      .eq("user_id", user.id);

    if (assignments && assignments.length > 0) {
      const locs = assignments.map((a: any) => ({
        id: a.company_locations.id,
        name: a.company_locations.name,
        city: a.company_locations.city,
        state: a.company_locations.state,
        is_primary: a.is_primary,
      }));
      setLocations(locs);

      const saved = profile.active_location_id;
      if (saved && locs.find((l: any) => l.id === saved)) {
        setActiveLocation(saved);
      } else {
        const primary = locs.find((l: any) => l.is_primary) ?? locs[0];
        setActiveLocation(primary.id);
      }
    }
  }

  async function switchLocation(locationId: string) {
    setActiveLocation(locationId);
    setOpen(false);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    await supabase
      .from("profiles")
      .update({ active_location_id: locationId })
      .eq("id", user.id);
  }

  function handleManageLocations() {
    window.location.href = "/dashboard/admin/locations";
  }

  const activeLocationObj = locations.find((l) => l.id === activeLocation);
  const isAdmin = ["admin", "director", "developer"].includes(role ?? "");

  if (locations.length <= 1 && !company) return null;

  return (
    <div className="relative mb-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm hover:border-blue-300 hover:shadow-sm transition-all w-full md:w-auto"
      >
        <span className="text-lg">🏢</span>
        <div className="text-left flex-1">
          {company && (
            <p className="text-xs text-gray-400 leading-none mb-0.5">{company.name}</p>
          )}
          <p className="font-medium text-gray-800 leading-none">
            {activeLocationObj
              ? `${activeLocationObj.name}${activeLocationObj.city ? ` — ${activeLocationObj.city}` : ""}`
              : "All Locations"}
          </p>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden" style={{ minWidth: "256px" }}>
          <div className="p-2 border-b border-gray-100">
            <p className="text-xs text-gray-400 px-2 py-1 font-medium uppercase tracking-wide">
              Switch Location
            </p>
          </div>

          <div className="p-1">
            {locations.map((loc) => (
              <button
                key={loc.id}
                type="button"
                onClick={() => switchLocation(loc.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                  activeLocation === loc.id
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    activeLocation === loc.id ? "bg-blue-500" : "bg-gray-300"
                  }`}
                />
                <div className="flex-1">
                  <p className="font-medium">{loc.name}</p>
                  {(loc.city || loc.state) && (
                    <p className="text-xs text-gray-400">
                      {[loc.city, loc.state].filter(Boolean).join(", ")}
                    </p>
                  )}
                  {loc.is_primary && (
                    <p className="text-xs text-blue-500">Primary</p>
                  )}
                </div>
                {activeLocation === loc.id && (
                  <span className="text-blue-500 text-xs font-bold">✓ Active</span>
                )}
              </button>
            ))}
          </div>

          {isAdmin && (
            <div className="border-t border-gray-100 p-2">
              <button
                type="button"
                onClick={handleManageLocations}
                className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors w-full text-left"
              >
                <span>⚙️</span>
                <span>Manage Locations</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}