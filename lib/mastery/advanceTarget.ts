import { SupabaseClient } from "@supabase/supabase-js";

export async function advanceTarget(
  supabaseAdmin: SupabaseClient,
  targetId: string,
  reviewedBy: string,
  actionTaken: "auto_advanced" | "manual_advance"
) {
  const { data: target, error: targetError } = await supabaseAdmin
    .from("skill_targets")
    .select("*")
    .eq("id", targetId)
    .single();
  if (targetError || !target) throw new Error("Target not found");

  const { data: currentLevel } = await supabaseAdmin
    .from("prompt_levels")
    .select("level_number")
    .eq("target_id", targetId)
    .eq("label", target.current_prompt_level)
    .maybeSingle();

  const currentLevelNumber = currentLevel?.level_number ?? null;

  if (currentLevelNumber !== null && currentLevelNumber > 1) {
    const { data: nextLevel } = await supabaseAdmin
      .from("prompt_levels")
      .select("label")
      .eq("target_id", targetId)
      .eq("level_number", currentLevelNumber - 1)
      .single();

    await supabaseAdmin
      .from("skill_targets")
      .update({
        current_prompt_level: nextLevel?.label,
        pending_advancement: false,
      })
      .eq("id", targetId);

    await supabaseAdmin.from("mastery_advancement_log").insert({
      target_id: targetId,
      company_id: target.company_id,
      client_id: target.client_id,
      criteria_met: true,
      action_taken: actionTaken,
      previous_status: target.current_prompt_level,
      new_status: nextLevel?.label,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
    });

    return { advancedTo: nextLevel?.label, fullyMastered: false };
  }

  await supabaseAdmin
    .from("skill_targets")
    .update({ status: "mastered", pending_advancement: false })
    .eq("id", targetId);

  await supabaseAdmin.from("mastery_advancement_log").insert({
    target_id: targetId,
    company_id: target.company_id,
    client_id: target.client_id,
    criteria_met: true,
    action_taken: actionTaken,
    previous_status: target.status,
    new_status: "mastered",
    reviewed_by: reviewedBy,
    reviewed_at: new Date().toISOString(),
  });

  const { data: currentStep } = await supabaseAdmin
    .from("target_sequence_steps")
    .select("sequence_id, position")
    .eq("target_id", targetId)
    .maybeSingle();

  if (currentStep) {
    const { data: nextStep } = await supabaseAdmin
      .from("target_sequence_steps")
      .select("target_id")
      .eq("sequence_id", currentStep.sequence_id)
      .eq("position", currentStep.position + 1)
      .maybeSingle();

    if (nextStep) {
      await supabaseAdmin
        .from("skill_targets")
        .update({ status: "active" })
        .eq("id", nextStep.target_id)
        .neq("status", "mastered");
    }
  }

  return { advancedTo: null, fullyMastered: true };
}