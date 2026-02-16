import { getAuthPayload } from "./_lib/auth.js";
import { ensureAdminSeed, getUsers, getUsageLogs } from "./_lib/db.js";
import { badRequest, json, methodNotAllowed } from "./_lib/http.js";

export async function handler(event) {
  if (event.httpMethod !== "GET") return methodNotAllowed(["GET"]);
  await ensureAdminSeed();

  const auth = getAuthPayload(event);
  const guestId = event.queryStringParameters?.guestId?.trim();
  const showAll = event.queryStringParameters?.all === "1";

  const [users, logs] = await Promise.all([getUsers(), getUsageLogs()]);

  let filtered = [];
  if (auth?.sub) {
    const user = users.find((item) => item.id === auth.sub);
    if (!user) return json(200, { ok: true, items: [] });
    if (user.role === "admin" && showAll) filtered = logs;
    else filtered = logs.filter((item) => item.actorType === "user" && item.actorId === user.id);
  } else {
    if (!guestId) return badRequest("guestId is required for guest history");
    filtered = logs.filter((item) => item.actorType === "guest" && item.actorId === guestId);
  }

  const items = filtered
    .slice()
    .sort((a, b) => b.usedAt.localeCompare(a.usedAt))
    .slice(0, 50)
    .map((item) => ({
      id: item.id,
      maskedNumber: item.maskedNumber,
      month: item.month,
      year: item.year,
      status: item.status || "Live Hit Success ✅",
      usedAt: item.usedAt,
      actorLabel: item.actorLabel
    }));

  return json(200, { ok: true, items });
}
