import "server-only";
import { serverDb } from "./lifecycle";
export async function portalUser(request: Request, allowGuest = false) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer ([^\s]+)$/)?.[1];
  if (!token || token.length > 8192) return null;
  const db = serverDb();
  const { data, error } = await db.auth.getUser(token);
  if (
    error ||
    !data.user ||
    (!allowGuest && (data.user.is_anonymous || !data.user.email_confirmed_at))
  )
    return null;
  return { user: data.user, db };
}
