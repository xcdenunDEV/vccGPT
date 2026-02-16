import { getAuthPayload, hashPassword, verifyPassword } from "./_lib/auth.js";
import { ensureAdminSeed, getUsers, saveUsers } from "./_lib/db.js";
import { badRequest, forbidden, json, methodNotAllowed, parseBody, unauthorized } from "./_lib/http.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") return methodNotAllowed(["POST"]);

  await ensureAdminSeed(event);
  const auth = getAuthPayload(event);
  if (!auth?.sub) return unauthorized();

  const users = await getUsers(event);
  const adminUser = users.find((item) => item.id === auth.sub);
  if (!adminUser || adminUser.role !== "admin") return forbidden("Admin only");

  let body;
  try {
    body = parseBody(event);
  } catch (error) {
    return badRequest(error.message);
  }

  const currentPassword = String(body.currentPassword || "").trim();
  const newPassword = String(body.newPassword || "").trim();
  const confirmPassword = String(body.confirmPassword || "").trim();

  if (!currentPassword || !newPassword || !confirmPassword) {
    return badRequest("currentPassword, newPassword, and confirmPassword are required");
  }

  if (!verifyPassword(currentPassword, adminUser.passwordHash)) {
    return badRequest("Password lama salah");
  }

  if (newPassword.length < 6) {
    return badRequest("Password baru minimal 6 karakter");
  }

  if (newPassword !== confirmPassword) {
    return badRequest("Konfirmasi password tidak sama");
  }

  if (verifyPassword(newPassword, adminUser.passwordHash)) {
    return badRequest("Password baru harus berbeda dari password lama");
  }

  adminUser.passwordHash = hashPassword(newPassword);
  await saveUsers(event, users);

  return json(200, {
    ok: true,
    message: "Password admin berhasil diubah"
  });
}

