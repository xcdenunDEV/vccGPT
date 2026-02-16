import { getAuthPayload } from "./_lib/auth.js";
import { ensureAdminSeed, getUsers, getVccPool, saveVccPool } from "./_lib/db.js";
import { badRequest, forbidden, json, methodNotAllowed, parseBody, unauthorized } from "./_lib/http.js";
import { parseVccLine } from "./_lib/vcc.js";

function isAdmin(users, authPayload) {
  if (!authPayload?.sub) return false;
  const user = users.find((item) => item.id === authPayload.sub);
  return Boolean(user && user.role === "admin");
}

function splitLines(input) {
  const raw =
    Array.isArray(input)
      ? input
          .map((item) => String(item))
          .join("\n")
      : String(input || "");

  return raw
    .replace(/[;,]+/g, "\n")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function keyFromVcc(vcc) {
  return `${vcc.number}|${vcc.month}|${vcc.year}|${vcc.cvv}`;
}

export async function handler(event) {
  if (!["GET", "POST", "DELETE"].includes(event.httpMethod)) {
    return methodNotAllowed(["GET", "POST", "DELETE"]);
  }

  await ensureAdminSeed(event);
  const auth = getAuthPayload(event);
  const users = await getUsers(event);
  if (!auth?.sub) return unauthorized();
  if (!isAdmin(users, auth)) return forbidden("Admin only");

  const vccPool = await getVccPool(event);

  if (event.httpMethod === "GET") {
    const items = vccPool
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((item) => ({
        id: item.id,
        number: item.number,
        month: item.month,
        year: item.year,
        cvv: item.cvv,
        used: Boolean(item.used),
        usedAt: item.usedAt || null,
        usedByType: item.usedByType || null
      }));
    return json(200, { ok: true, items });
  }

  let body;
  try {
    body = parseBody(event);
  } catch (error) {
    return badRequest(error.message);
  }

  if (event.httpMethod === "POST") {
    const lines = splitLines(body.lines);
    if (lines.length === 0) return badRequest("No VCC lines found");
    if (lines.length > 5000) return badRequest("Max 5000 lines per batch");

    const existingKeys = new Set(vccPool.map(keyFromVcc));
    const invalidLines = [];
    const duplicateLines = [];
    const addedItems = [];

    for (const rawLine of lines) {
      const parsed = parseVccLine(rawLine);
      if (!parsed) {
        invalidLines.push(rawLine);
        continue;
      }
      const key = keyFromVcc(parsed);
      if (existingKeys.has(key)) {
        duplicateLines.push(rawLine);
        continue;
      }
      existingKeys.add(key);
      addedItems.push(parsed);
    }

    if (addedItems.length > 0) {
      vccPool.push(...addedItems);
      await saveVccPool(event, vccPool);
    }

    return json(200, {
      ok: true,
      added: addedItems.length,
      invalid: invalidLines.length,
      duplicates: duplicateLines.length,
      invalidLines
    });
  }

  const vccId = String(body.vccId || "").trim();
  if (!vccId) return badRequest("vccId is required");

  const index = vccPool.findIndex((item) => item.id === vccId);
  if (index < 0) return badRequest("VCC not found");

  vccPool.splice(index, 1);
  await saveVccPool(event, vccPool);
  return json(200, { ok: true });
}
