const ADMIN_EMAILS = ["hisully92@gmail.com"];

export async function isAdmin(email?: string | null) {
  if (!email) return false;

  return ADMIN_EMAILS.includes(email);
}