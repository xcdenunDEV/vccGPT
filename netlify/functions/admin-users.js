import crypto from "node:crypto";
import { getAuthPayload, hashPassword } from "./_lib/auth.js";
import { applyCumulativeCredits } from "./_lib/credits.js";
import { ensureAdminSeed, getUsers, sanitizeUser, saveUsers } from "./_lib/db.js";
import { badRequest, forbidden, json, methodNotAllowed, parseBody, unauthorized } from "./_lib/http.js";

function getAdmin(users, authPayload) {
  if (!authPayload?.sub) return null;
  const user = users.find((item) => item.id === authPayload.sub);
  if (!user || user.role !== "admin") return null;
  return user;
}

function normalizeRole(role) {
  const clean = String(role || "").trim().toLowerCase();
  if (["free", "premium", "admin"].includes(clean)) return clean;
  return null;
}

function parseCreditDelta(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.trunc(number);
}

export async function handler(event) {
  if (!["GET", "POST", "PATCH"].includes(event.httpMethod)) {
    return methodNotAllowed(["GET", "POST", "PATCH"]);
  }

  await ensureAdminSeed();
  const auth = getAuthPayload(event);
  const users = await getUsers();
  const adminUser = getAdmin(users, auth);
  if (!auth?.sub) return unauthorized();
  if (!adminUser) return forbidden("Admin only");

  if (event.httpMethod === "GET") {
    let changed = false;
    for (const user of users) {
      const result = applyCumulativeCredits(user, user.role);
      if (result.changed) changed = true;
    }
    if (changed) await saveUsers(users);

    return json(200, {
      ok: true,
      items: users.map(sanitizeUser)
    });
  }

  let body;
  try {
    body = parseBody(event);
  } catch (error) {
    return badRequest(error.message);
  }

  if (event.httpMethod === "POST") {
    const username = String(body.username || "").trim();
    const password = String(body.password || "").trim();
    const role = normalizeRole(body.role);
    const initialCredits = parseCreditDelta(body.initialCredits ?? 0);

    if (!username || !password) return badRequest("Username and password are required");
    if (!role) return badRequest("Invalid role. Use free/premium/admin");
    if (users.some((item) => item.username.toLowerCase() === username.toLowerCase())) {
      return badRequest("Username already exists");
    }
    if (password.length < 4) return badRequest("Password minimum 4 characters");
    if (initialCredits === null) return badRequest("Invalid initial credits");

    const newUser = {
      id: crypto.randomUUID(),
      username,
      passwordHash: hashPassword(password),
      role,
      credits: role === "admin" ? null : Math.max(0, initialCredits),
      lastCreditAt: null,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    await saveUsers(users);
    return json(200, { ok: true, user: sanitizeUser(newUser) });
  }

  const targetId = String(body.userId || "").trim();
  if (!targetId) return badRequest("userId is required");

  const targetUser = users.find((item) => item.id === targetId);
  if (!targetUser) return badRequest("User not found");

  const changedRole = body.role ? normalizeRole(body.role) : null;
  const hasCreditDelta = Object.prototype.hasOwnProperty.call(body, "creditDelta");
  const creditDelta = hasCreditDelta ? parseCreditDelta(body.creditDelta) : null;

  if (body.role && !changedRole) return badRequest("Invalid role");
  if (hasCreditDelta && creditDelta === null) return badRequest("Invalid creditDelta");

  if (changedRole) {
    targetUser.role = changedRole;
    if (changedRole === "admin") targetUser.credits = null;
    if (changedRole !== "admin" && (targetUser.credits === null || targetUser.credits === undefined)) {
      targetUser.credits = 0;
    }
  }

  if (hasCreditDelta && targetUser.role !== "admin") {
    targetUser.credits = Math.max(0, Number(targetUser.credits || 0) + creditDelta);
  }

  await saveUsers(users);
  return json(200, { ok: true, user: sanitizeUser(targetUser) });
}
