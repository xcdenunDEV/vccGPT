import crypto from "node:crypto";
import { connectLambda, getStore } from "@netlify/blobs";
import { hashPassword } from "./auth.js";
import { DAILY_CREDIT } from "./credits.js";

const KEYS = {
  users: "users",
  vccPool: "vcc-pool",
  guests: "guests",
  usageLogs: "usage-logs"
};

function getBlobStore(event) {
  if (event) {
    connectLambda(event);
  }
  return getStore("vcc-gpt");
}

export async function getJson(event, key, fallbackValue) {
  const store = getBlobStore(event);
  const value = await store.get(key, { type: "json" });
  return value ?? fallbackValue;
}

export async function setJson(event, key, value) {
  const store = getBlobStore(event);
  await store.setJSON(key, value);
}

export async function getUsers(event) {
  return getJson(event, KEYS.users, []);
}

export async function saveUsers(event, users) {
  await setJson(event, KEYS.users, users);
}

export async function getVccPool(event) {
  return getJson(event, KEYS.vccPool, []);
}

export async function saveVccPool(event, vccPool) {
  await setJson(event, KEYS.vccPool, vccPool);
}

export async function getGuests(event) {
  return getJson(event, KEYS.guests, {});
}

export async function saveGuests(event, guests) {
  await setJson(event, KEYS.guests, guests);
}

export async function getUsageLogs(event) {
  return getJson(event, KEYS.usageLogs, []);
}

export async function saveUsageLogs(event, usageLogs) {
  await setJson(event, KEYS.usageLogs, usageLogs);
}

export function sanitizeUser(user) {
  const isAdmin = user.role === "admin";
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    credits: isAdmin ? null : Number(user.credits || 0),
    creditsLabel: isAdmin ? "Unlimited" : String(Number(user.credits || 0)),
    dailyCredit: isAdmin ? null : DAILY_CREDIT[user.role] || 0,
    lastCreditAt: user.lastCreditAt || null,
    createdAt: user.createdAt || null
  };
}

export async function ensureAdminSeed(event) {
  const users = await getUsers(event);
  if (users.length > 0) return users;

  const adminUsername = (process.env.VCC_ADMIN_USERNAME || "admin").trim();
  const adminPassword = process.env.VCC_ADMIN_PASSWORD || "admin12345";

  const adminUser = {
    id: crypto.randomUUID(),
    username: adminUsername,
    passwordHash: hashPassword(adminPassword),
    role: "admin",
    credits: null,
    lastCreditAt: null,
    createdAt: new Date().toISOString()
  };

  await saveUsers(event, [adminUser]);
  return [adminUser];
}
