import crypto from "node:crypto";
import { getAuthPayload } from "./_lib/auth.js";
import { applyCumulativeCredits } from "./_lib/credits.js";
import {
  ensureAdminSeed,
  getGuests,
  getUsageLogs,
  getUsers,
  getVccPool,
  saveGuests,
  saveUsageLogs,
  saveUsers,
  saveVccPool
} from "./_lib/db.js";
import { badRequest, json, methodNotAllowed, parseBody } from "./_lib/http.js";
import { maskCardNumber } from "./_lib/vcc.js";

function pickAvailableVcc(vccPool) {
  const availableItems = vccPool.filter((item) => !item.used);
  if (availableItems.length === 0) return null;
  const selected = availableItems[Math.floor(Math.random() * availableItems.length)];
  const index = vccPool.findIndex((item) => item.id === selected.id);
  return { index, selected };
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return methodNotAllowed(["POST"]);
  await ensureAdminSeed();

  let body;
  try {
    body = parseBody(event);
  } catch (error) {
    return badRequest(error.message);
  }

  const guestId = String(body.guestId || "").trim();
  const auth = getAuthPayload(event);

  const [users, guests, vccPool, usageLogs] = await Promise.all([
    getUsers(),
    getGuests(),
    getVccPool(),
    getUsageLogs()
  ]);

  let actorType = "guest";
  let actorId = guestId;
  let actorLabel = guestId;
  let actorRole = "guest";
  let actorCredits = 0;
  let actorChanged = false;
  let actingUser = null;
  let actingGuest = null;

  if (auth?.sub) {
    const user = users.find((item) => item.id === auth.sub);
    if (user) {
      actingUser = user;
      actorType = "user";
      actorId = user.id;
      actorLabel = user.username;
      actorRole = user.role;
      const { changed } = applyCumulativeCredits(user, user.role);
      actorChanged = changed;
      actorCredits = user.role === "admin" ? Infinity : Number(user.credits || 0);
    }
  }

  if (!actingUser) {
    if (!guestId) return badRequest("guestId is required for guest generation");
    actingGuest = guests[guestId] || { credits: 0, lastCreditAt: null };
    const { changed } = applyCumulativeCredits(actingGuest, "guest");
    actorChanged = changed;
    actorCredits = Number(actingGuest.credits || 0);
    guests[guestId] = actingGuest;
  }

  if (actorRole !== "admin" && actorCredits < 1) {
    if (actingUser && actorChanged) await saveUsers(users);
    if (actingGuest && actorChanged) await saveGuests(guests);
    return json(402, {
      ok: false,
      message: "Credit habis. Topup dulu untuk lanjut generate."
    });
  }

  const picked = pickAvailableVcc(vccPool);
  if (!picked) {
    if (actingUser && actorChanged) await saveUsers(users);
    if (actingGuest && actorChanged) await saveGuests(guests);
    return json(409, {
      ok: false,
      message: "Tidak ada VCC tersedia. Hubungi admin untuk isi ulang list."
    });
  }

  const now = new Date().toISOString();
  const selected = picked.selected;

  vccPool[picked.index] = {
    ...selected,
    used: true,
    usedAt: now,
    usedById: actorId,
    usedByType: actorType
  };

  if (actorRole !== "admin") {
    if (actingUser) actingUser.credits = Math.max(0, Number(actingUser.credits || 0) - 1);
    if (actingGuest) actingGuest.credits = Math.max(0, Number(actingGuest.credits || 0) - 1);
  }

  const historyEntry = {
    id: crypto.randomUUID(),
    vccId: selected.id,
    maskedNumber: maskCardNumber(selected.number),
    month: selected.month,
    year: selected.year,
    status: "Live Hit Success ✅",
    usedAt: now,
    actorType,
    actorId,
    actorLabel
  };

  usageLogs.unshift(historyEntry);
  if (usageLogs.length > 1000) usageLogs.length = 1000;

  await saveVccPool(vccPool);
  await saveUsageLogs(usageLogs);
  if (actingUser) await saveUsers(users);
  if (actingGuest) await saveGuests(guests);

  const remainingCredits =
    actorRole === "admin"
      ? "Unlimited"
      : actingUser
        ? Number(actingUser.credits || 0)
        : Number(actingGuest?.credits || 0);

  return json(200, {
    ok: true,
    message: "VCC dummy berhasil digenerate",
    remainingCredits,
    generated: {
      number: selected.number,
      month: selected.month,
      year: selected.year,
      cvv: selected.cvv
    },
    historyEntry
  });
}
