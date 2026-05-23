import { supabaseAdmin } from "@/lib/supabase/server";

export async function createJob({
  id,
  userId,
  type,
  payload,
  status,
}: {
  id: string;
  userId: string;
  type: string;
  payload: any;
  status: string;
}) {
  const { error } = await supabaseAdmin.from("jobs").insert({
    id,
    user_id: userId,
    type,
    payload,
    status,
  });

  if (error) {
    throw new Error(`createJob failed: ${error.message}`);
  }

  return { id };
}