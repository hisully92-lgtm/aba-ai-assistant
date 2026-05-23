import { getUserWithPlan } from "./getUserWithPlan";

export async function requirePro() {
  const { user, plan } = await getUserWithPlan();

  if (!user) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized",
    };
  }

  if (plan !== "pro") {
    return {
      ok: false,
      status: 403,
      error: "Pro plan required",
    };
  }

  return {
    ok: true,
    user,
  };
}