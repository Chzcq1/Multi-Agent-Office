import { supabase, getSupabaseAdmin } from "./client";

export const WELCOME_CREDITS = 100;
export const CREDITS_PER_TASK_LEVEL: Record<0 | 1 | 2 | 3, number> = {
  0: 0,
  1: 1,
  2: 3,
  3: 8,
};

export interface UserCredits {
  userId: string;
  email: string | null;
  displayName: string | null;
  credits: number;
  totalCreditsUsed: number;
}

export async function getCredits(userId: string): Promise<UserCredits | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("user_credits")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error || !data) return null;
  return {
    userId: data.user_id,
    email: data.email,
    displayName: data.display_name,
    credits: data.credits,
    totalCreditsUsed: data.total_credits_used,
  };
}

export async function ensureCreditsRow(userId: string, email?: string, displayName?: string): Promise<UserCredits> {
  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from("user_credits")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (existing) {
    return {
      userId: existing.user_id,
      email: existing.email,
      displayName: existing.display_name,
      credits: existing.credits,
      totalCreditsUsed: existing.total_credits_used,
    };
  }

  const { data, error } = await admin
    .from("user_credits")
    .insert({
      user_id: userId,
      email: email ?? null,
      display_name: displayName ?? null,
      credits: WELCOME_CREDITS,
      total_credits_used: 0,
    })
    .select()
    .single();

  if (error || !data) throw new Error("Failed to create credits row: " + (error?.message ?? "unknown"));

  await admin.from("credit_transactions").insert({
    user_id: userId,
    amount: WELCOME_CREDITS,
    type: "welcome_bonus",
    description: `ยินดีต้อนรับ! รับเครดิตเริ่มต้น ${WELCOME_CREDITS} เครดิต`,
  });

  return {
    userId: data.user_id,
    email: data.email,
    displayName: data.display_name,
    credits: data.credits,
    totalCreditsUsed: data.total_credits_used,
  };
}

export async function deductCredits(
  userId: string,
  amount: number,
  taskId?: number,
  description?: string
): Promise<{ success: boolean; remainingCredits: number; error?: string }> {
  const admin = getSupabaseAdmin();
  const { data: row } = await admin
    .from("user_credits")
    .select("credits")
    .eq("user_id", userId)
    .single();

  if (!row) return { success: false, remainingCredits: 0, error: "User not found" };
  if (row.credits < amount) return { success: false, remainingCredits: row.credits, error: "Insufficient credits" };

  const { data: updated, error } = await admin
    .from("user_credits")
    .update({
      credits: row.credits - amount,
      total_credits_used: row.credits,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select("credits")
    .single();

  if (error || !updated) return { success: false, remainingCredits: row.credits, error: error?.message };

  await admin.from("credit_transactions").insert({
    user_id: userId,
    amount: -amount,
    type: "debit",
    description: description ?? `การวิเคราะห์ (${amount} เครดิต)`,
    task_id: taskId ?? null,
  });

  return { success: true, remainingCredits: updated.credits };
}

export async function addCredits(
  userId: string,
  amount: number,
  type: "credit" | "refund",
  description?: string
): Promise<{ success: boolean; newBalance: number }> {
  const admin = getSupabaseAdmin();
  const { data: row } = await admin
    .from("user_credits")
    .select("credits")
    .eq("user_id", userId)
    .single();

  if (!row) return { success: false, newBalance: 0 };

  const { data: updated } = await admin
    .from("user_credits")
    .update({
      credits: row.credits + amount,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select("credits")
    .single();

  if (!updated) return { success: false, newBalance: row.credits };

  await admin.from("credit_transactions").insert({
    user_id: userId,
    amount,
    type,
    description: description ?? `เพิ่มเครดิต ${amount}`,
  });

  return { success: true, newBalance: updated.credits };
}
