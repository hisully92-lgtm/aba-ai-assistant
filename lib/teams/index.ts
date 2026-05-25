import { supabase } from "@/lib/supabase/client";
import { supabaseAdmin } from "@/lib/supabase/server";

export type Company = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

export type CompanyUser = {
  id: string;
  company_id: string;
  user_id: string;
  role_id: string | null;
  status: string;
  created_at: string;
};

export type Invite = {
  id: string;
  company_id: string;
  email: string;
  role_id: string | null;
  token: string;
  status: string;
  expires_at: string;
  created_at: string;
};

export type Location = {
  id: string;
  company_id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  created_at: string;
};

// GET USER'S COMPANY
export async function getUserCompany(): Promise<Company | null> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return null;

  const { data } = await supabase
    .from("company_users")
    .select("company_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!data?.company_id) return null;

  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", data.company_id)
    .single();

  return company ?? null;
}

// GET COMPANY MEMBERS
export async function getCompanyMembers(companyId: string): Promise<CompanyUser[]> {
  const { data } = await supabase
    .from("company_users")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

// GET PENDING INVITES
export async function getCompanyInvites(companyId: string): Promise<Invite[]> {
  const { data } = await supabase
    .from("invites")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return data ?? [];
}

// GET LOCATIONS
export async function getCompanyLocations(companyId: string): Promise<Location[]> {
  const { data } = await supabase
    .from("locations")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

// SEND INVITE
export async function sendInvite(
  companyId: string,
  email: string,
  roleId?: string
): Promise<{ success: boolean; error?: string }> {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("invites").insert({
    company_id: companyId,
    email: email.trim().toLowerCase(),
    role_id: roleId ?? null,
    token,
    status: "pending",
    expires_at: expiresAt,
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// CANCEL INVITE
export async function cancelInvite(inviteId: string): Promise<void> {
  await supabase
    .from("invites")
    .update({ status: "cancelled" })
    .eq("id", inviteId);
}

// REMOVE MEMBER
export async function removeMember(memberId: string): Promise<void> {
  await supabase
    .from("company_users")
    .update({ status: "inactive" })
    .eq("id", memberId);
}

// ADD LOCATION
export async function addLocation(
  companyId: string,
  location: Omit<Location, "id" | "company_id" | "created_at">
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from("locations").insert({
    company_id: companyId,
    ...location,
  });

  if (error) return { success: false, error: error.message };
  return { success: true };
}