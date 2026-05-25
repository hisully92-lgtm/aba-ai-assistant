"use client";

import { useEffect, useState } from "react";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import {
  getUserCompany,
  getCompanyLocations,
  addLocation,
  type Company,
  type Location,
} from "@/lib/teams";
import { useRole } from "@/lib/hooks/useRole";

const emptyForm = {
  name: "",
  address: "",
  city: "",
  state: "",
  zip: "",
};

export default function LocationsPage() {
  const { isSupervisor, loading: roleLoading } = useRole();
  const [company, setCompany] = useState<Company | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const co = await getUserCompany();
      setCompany(co);
      if (co) {
        const locs = await getCompanyLocations(co.id);
        setLocations(locs);
      }
      setLoading(false);
    }
    init();
  }, []);

  async function handleAdd() {
    if (!company || !form.name.trim()) return;
    setSaving(true);
    setError(null);

    const result = await addLocation(company.id, form);

    if (result.success) {
      setSuccess(true);
      setForm(emptyForm);
      setShowForm(false);
      const locs = await getCompanyLocations(company.id);
      setLocations(locs);
    } else {
      setError(result.error ?? "Failed to add location");
    }

    setSaving(false);
  }

  if (roleLoading || loading) {
    return <div className="p-6 text-gray-400">Loading locations...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Clinic Locations">
        <p className="text-gray-500 text-sm">Manage your clinic's physical locations.</p>
      </PageHeader>

      {/* LOCATION LIST */}
      <Section title={`Locations (${locations.length})`}>
        {locations.length === 0 ? (
          <p className="text-gray-400 text-sm">No locations added yet.</p>
        ) : (
          <div className="space-y-2">
            {locations.map((loc) => (
              <div
                key={loc.id}
                className="border border-gray-100 rounded-lg p-4 bg-white"
              >
                <p className="font-medium text-gray-800">{loc.name}</p>
                {(loc.address || loc.city || loc.state) && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    {[loc.address, loc.city, loc.state, loc.zip]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {isSupervisor && (
          <div className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowForm(!showForm)}
            >
              {showForm ? "Cancel" : "+ Add Location"}
            </Button>
          </div>
        )}
      </Section>

      {/* ADD LOCATION FORM */}
      {showForm && isSupervisor && (
        <Section title="Add Location">
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 mb-3">
              Location added successfully.
            </div>
          )}

          <div className="flex flex-col gap-3 max-w-md">
            {(Object.entries(form) as [keyof typeof emptyForm, string][]).map(([key, value]) => (
              <div key={key}>
                <label className="text-sm font-medium text-gray-700 mb-1 block capitalize">
                  {key}
                </label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  placeholder={key}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            ))}
            <Button onClick={handleAdd} loading={saving}>
              Save Location
            </Button>
          </div>
        </Section>
      )}
    </div>
  );
}