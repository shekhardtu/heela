import { cookies } from "next/headers";
import { heeApi, type MeResponse } from "./hee-api";

export const SESSION_COOKIE = "hee_session";

/**
 * Called by server components + route handlers to fetch the signed-in user.
 * Returns null when no cookie OR the control plane rejects the token —
 * callers decide whether to redirect or render a signed-out state.
 */
export async function getSessionUser(): Promise<MeResponse | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await heeApi.auth.me(token);
  } catch {
    return null;
  }
}
