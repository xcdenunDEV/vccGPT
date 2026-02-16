import { getAuthPayload } from "./_lib/auth.js";
import { applyCumulativeCredits } from "./_lib/credits.js";
import { ensureAdminSeed, getUsers, sanitizeUser, saveUsers } from "./_lib/db.js";
import { json, methodNotAllowed } from "./_lib/http.js";

export async function handler(event) {
  if (event.httpMethod !== "GET") return methodNotAllowed(["GET"]);

  await ensureAdminSeed(event);
  const auth = getAuthPayload(event);
  if (!auth?.sub) return json(200, { ok: true, user: null });

  const users = await getUsers(event);
  const user = users.find((item) => item.id === auth.sub);
  if (!user) return json(200, { ok: true, user: null });

  const { changed } = applyCumulativeCredits(user, user.role);
  if (changed) await saveUsers(event, users);

  return json(200, {
    ok: true,
    user: sanitizeUser(user)
  });
}
