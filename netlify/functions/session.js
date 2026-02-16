import { getAuthPayload } from "./_lib/auth.js";
import { applyCumulativeCredits } from "./_lib/credits.js";
import {
  ensureAdminSeed,
  getGuests,
  getUsers,
  sanitizeUser,
  saveGuests,
  saveUsers
} from "./_lib/db.js";
import { json, methodNotAllowed } from "./_lib/http.js";

export async function handler(event) {
  if (event.httpMethod !== "GET") return methodNotAllowed(["GET"]);

  await ensureAdminSeed();
  const auth = getAuthPayload(event);

  if (auth?.sub) {
    const users = await getUsers();
    const user = users.find((item) => item.id === auth.sub);
    if (!user) return json(200, { ok: true, authenticated: false, user: null });

    const { changed } = applyCumulativeCredits(user, user.role);
    if (changed) await saveUsers(users);
    return json(200, {
      ok: true,
      authenticated: true,
      user: sanitizeUser(user)
    });
  }

  const guestId = event.queryStringParameters?.guestId?.trim();
  if (!guestId) {
    return json(200, {
      ok: true,
      authenticated: false,
      guest: null
    });
  }

  const guests = await getGuests();
  const hadGuest = Boolean(guests[guestId]);
  const existingGuest = guests[guestId] || { credits: 0, lastCreditAt: null };
  const { changed } = applyCumulativeCredits(existingGuest, "guest");
  guests[guestId] = existingGuest;
  if (changed || !hadGuest) await saveGuests(guests);

  return json(200, {
    ok: true,
    authenticated: false,
    guest: {
      id: guestId,
      credits: existingGuest.credits,
      creditsLabel: String(existingGuest.credits),
      dailyCredit: 1,
      lastCreditAt: existingGuest.lastCreditAt
    }
  });
}
