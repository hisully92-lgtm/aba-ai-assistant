"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Location = { id: string; name: string; address: string | null; lat: number | null; lng: number | null; radius: number | null };
type LocationCheck = {
  timestamp: string;
  lat: number;
  lng: number;
  status: "inside" | "outside" | "auto";
  locationName: string;
};

const NON_GPS_LOCATIONS = ["home", "school", "community", "telehealth"];

export default function GeofencePage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationCoords, setLocationCoords] = useState<Record<string, { lat: number; lng: number; radius: number }>>({});
  const [selectedLocation, setSelectedLocation] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<LocationCheck[]>([]);
  const [clientName, setClientName] = useState("");
  const [clients, setClients] = useState<{ id: string; full_name: string }[]>([]);

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) return;

      const [{ data: locationData }, { data: clientData }] = await Promise.all([
        supabase.from("locations").select("id, name, address, lat, lng, radius"),
        supabase.from("clients").select("id, full_name").eq("created_by", user.id),
      ]);

      const locs = locationData ?? [];
      setLocations(locs);
      setClients(clientData ?? []);

      // Build coords map from DB
      const coordMap: Record<string, { lat: number; lng: number; radius: number }> = {};
      locs.forEach((l: Location) => {
        if (l.lat && l.lng) {
          coordMap[l.id] = { lat: l.lat, lng: l.lng, radius: l.radius ?? 300 };
        }
      });
      setLocationCoords(coordMap);
    }
    load();
  }, []);

  function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function checkLocation() {
    if (!selectedLocation) { setError("Please select a location first."); return; }
    setChecking(true);
    setError(null);

    const locationName = NON_GPS_LOCATIONS.includes(selectedLocation)
      ? selectedLocation.charAt(0).toUpperCase() + selectedLocation.slice(1)
      : locations.find((l) => l.id === selectedLocation)?.name ?? selectedLocation;

    // Home/school/community/telehealth — always approved, no GPS needed
    if (NON_GPS_LOCATIONS.includes(selectedLocation)) {
      setHistory((prev) => [
        { timestamp: new Date().toISOString(), lat: 0, lng: 0, status: "auto", locationName },
        ...prev.slice(0, 9),
      ]);
      setChecking(false);
      return;
    }

    // Check if we have coordinates for this location
    const coords = locationCoords[selectedLocation];
    if (!coords) {
      setError("No GPS coordinates set for this location. Ask your admin to add lat/lng in Admin → Locations.");
      setChecking(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const distance = getDistance(latitude, longitude, coords.lat, coords.lng);
        const status = distance <= coords.radius ? "inside" : "outside";

        setHistory((prev) => [
          { timestamp: new Date().toISOString(), lat: latitude, lng: longitude, status, locationName },
          ...prev.slice(0, 9),
        ]);
        setChecking(false);
      },
      (err) => { setError(err.message); setChecking(false); }
    );
  }

  const lastCheck = history[0];

  function statusColor(status: string) {
    if (status === "inside") return "bg-green-50 border-green-200";
    if (status === "auto") return "bg-blue-50 border-blue-200";
    return "bg-red-50 border-red-200";
  }

  function statusTextColor(status: string) {
    if (status === "inside") return "text-green-700";
    if (status === "auto") return "text-blue-700";
    return "text-red-700";
  }

  function statusLabel(status: string) {
    if (status === "inside") return "✓ You are inside the clinic zone";
    if (status === "auto") return "✓ Location type approved automatically";
    return "✗ You are outside the clinic zone";
  }

  function badgeColor(status: string) {
    if (status === "inside") return "bg-green-100 text-green-700";
    if (status === "auto") return "bg-blue-100 text-blue-700";
    return "bg-red-100 text-red-700";
  }

  const selectedHasCoords = selectedLocation
    ? NON_GPS_LOCATIONS.includes(selectedLocation) || !!locationCoords[selectedLocation]
    : false;

  return (
    <div className="space-y-6">
      <PageHeader title="Geofence Clock-In">
        <p className="text-gray-500 text-sm">Verify your location before starting a session.</p>
      </PageHeader>

      {locations.length > 0 && Object.keys(locationCoords).length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-700">
          No GPS coordinates found for your clinic locations. Ask your admin to add lat/lng coordinates in Admin → Locations.
        </div>
      )}

      <Section title="Location Check">
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Client</label>
            <select value={clientName} onChange={(e) => setClientName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">Select client...</option>
              {clients.map((c) => <option key={c.id} value={c.full_name}>{c.full_name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Clinic Location *</label>
            <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">Select location...</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}{l.address ? ` — ${l.address}` : ""}{!locationCoords[l.id] ? " (no GPS)" : ""}
                </option>
              ))}
              <option value="home">Home Visit</option>
              <option value="school">School</option>
              <option value="community">Community</option>
              <option value="telehealth">Telehealth</option>
            </select>
            {selectedLocation && NON_GPS_LOCATIONS.includes(selectedLocation) && (
              <p className="text-xs text-blue-500 mt-1">This location type is automatically approved — no GPS check needed.</p>
            )}
            {selectedLocation && !NON_GPS_LOCATIONS.includes(selectedLocation) && !locationCoords[selectedLocation] && (
              <p className="text-xs text-orange-500 mt-1">No GPS coordinates set. Contact your admin.</p>
            )}
          </div>
        </div>

        <Button onClick={checkLocation} loading={checking} disabled={!selectedLocation || !selectedHasCoords}>
          📍 Check My Location
        </Button>

        {lastCheck && (
          <div className={`mt-4 border rounded-xl p-4 ${statusColor(lastCheck.status)}`}>
            <p className={`font-semibold text-sm ${statusTextColor(lastCheck.status)}`}>
              {statusLabel(lastCheck.status)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Location: {lastCheck.locationName}
              {clientName && ` · Client: ${clientName}`}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{new Date(lastCheck.timestamp).toLocaleString()}</p>
            {lastCheck.lat !== 0 && (
              <p className="text-xs text-gray-400">{lastCheck.lat.toFixed(5)}, {lastCheck.lng.toFixed(5)}</p>
            )}
          </div>
        )}
      </Section>

      {history.length > 0 && (
        <Section title="Check History">
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between border border-gray-100 rounded-lg p-3 bg-white">
                <div>
                  <p className="text-sm text-gray-700">{h.locationName}</p>
                  <p className="text-xs text-gray-400">{new Date(h.timestamp).toLocaleString()}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${badgeColor(h.status)}`}>
                  {h.status === "auto" ? "approved" : h.status}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}