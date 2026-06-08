import { getAuthPayload } from "./_lib/auth.js";
import { ensureAdminSeed, getUsers, getUsageLogs } from "./_lib/db.js";
import { badRequest, json, methodNotAllowed } from "./_lib/http.js";

export async function handler(event) {
  if (event.httpMethod !== "GET") return methodNotAllowed(["GET"]);
  await ensureAdminSeed(event);

  const auth = getAuthPayload(event);
  const guestId = event.queryStringParameters?.guestId?.trim();
  const showAll = event.queryStringParameters?.all === "1";

  const [users, logs] = await Promise.all([getUsers(event), getUsageLogs(event)]);

  let filtered = [];
  let sensorRequired = false;

  if (auth?.sub) {
    const user = users.find((item) => item.id === auth.sub);
    if (!user) return json(200, { ok: true, items: [] });
    if (user.role === "admin" && showAll) {
      filtered = logs;
      sensorRequired = false;
    } else {
      filtered = logs;
      sensorRequired = true;
    }
  } else {
    filtered = logs;
    sensorRequired = true;
  }

  const items = filtered
    .slice()
    .sort((a, b) => b.usedAt.localeCompare(a.usedAt))
    .slice(0, 50)
    .map((item) => {
      let isOwn = false;
      if (auth?.sub && item.actorType === "user" && item.actorId === auth.sub) {
        isOwn = true;
      } else if (guestId && item.actorType === "guest" && item.actorId === guestId) {
        isOwn = true;
      }

      if (!sensorRequired || isOwn) {
        return {
          id: item.id,
          maskedNumber: item.maskedNumber,
          month: item.month,
          year: item.year,
          status: item.status || "Live Hit Success ✅",
          usedAt: item.usedAt,
          actorLabel: item.actorLabel
        };
      } else {
        const masked = item.maskedNumber ? item.maskedNumber.slice(0, -4) + "XXXX" : "XXXX";
        let maskedActor = "User";
        if (item.actorType === "guest") {
          maskedActor = "Guest";
        } else if (item.actorLabel) {
          const len = item.actorLabel.length;
          if (len <= 2) {
            maskedActor = "**";
          } else {
            maskedActor = item.actorLabel.slice(0, 2) + "***";
          }
        }

        return {
          id: item.id,
          maskedNumber: masked,
          month: "XX",
          year: "XXXX",
          status: item.status || "Live Hit Success ✅",
          usedAt: item.usedAt,
          actorLabel: maskedActor
        };
      }
    });

  return json(200, { ok: true, items });
}
