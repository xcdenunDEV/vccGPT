import { signToken, verifyPassword } from "./_lib/auth.js";
import { applyCumulativeCredits } from "./_lib/credits.js";
import { ensureAdminSeed, getUsers, sanitizeUser, saveUsers } from "./_lib/db.js";
import { badRequest, json, methodNotAllowed, parseBody, unauthorized } from "./_lib/http.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") return methodNotAllowed(["POST"]);

  await ensureAdminSeed();

  let body;
  try {
    body = parseBody(event);
  } catch (error) {
    return badRequest(error.message);
  }

  const username = String(body.username || "").trim();
  const password = String(body.password || "").trim();
  if (!username || !password) return badRequest("Username and password are required");

  const users = await getUsers();
  const user = users.find((item) => item.username.toLowerCase() === username.toLowerCase());
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return unauthorized("Invalid username or password");
  }

  const { changed } = applyCumulativeCredits(user, user.role);
  if (changed) await saveUsers(users);

  const token = signToken({
    sub: user.id,
    username: user.username,
    role: user.role
  });

  return json(200, {
    ok: true,
    token,
    user: sanitizeUser(user)
  });
}
