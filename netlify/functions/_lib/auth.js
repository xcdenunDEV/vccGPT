import crypto from "node:crypto";

const TOKEN_SECRET = process.env.VCC_TOKEN_SECRET || "vcc-gpt-dev-secret-change-me";
const TOKEN_TTL_SECONDS = Number(process.env.VCC_TOKEN_TTL_SECONDS || 60 * 60 * 24 * 30);

function base64urlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function base64urlDecode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signRaw(value) {
  return crypto.createHmac("sha256", TOKEN_SECRET).update(value).digest("base64url");
}

export function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export function verifyPassword(password, hashedPassword) {
  return hashPassword(password) === hashedPassword;
}

export function signToken(payload) {
  const header = base64urlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64urlEncode(
    JSON.stringify({
      ...payload,
      iat: now,
      exp: now + TOKEN_TTL_SECONDS
    })
  );
  const signature = signRaw(`${header}.${body}`);
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  const expectedSignature = signRaw(`${header}.${body}`);
  if (signature !== expectedSignature) return null;
  try {
    const payload = JSON.parse(base64urlDecode(body));
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp < now) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getAuthPayload(event) {
  const authorization = event.headers?.authorization || event.headers?.Authorization;
  if (!authorization) return null;
  const [scheme, token] = authorization.split(" ");
  if (!token || scheme.toLowerCase() !== "bearer") return null;
  return verifyToken(token);
}

