import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";
import { hashPassword } from "./auth.js";
import { DAILY_CREDIT } from "./credits.js";

const store = getStore({ name: "vcc-gpt" });

const KEYS = {
  users: "users",
  vccPool: "vcc-pool",
  guests: "guests",
  usageLogs: "usage-logs"
};

export async function getJson(key, fallbackValue) {
  const value = await store.get(key, { type: "json" });
  return value ?? fallbackValue;
}

export async function setJson(key, value) {
  await store.setJSON(key, value);
}

export async function getUsers() {
  return getJson(KEYS.users, []);
}

export async function saveUsers(users) {
  await setJson(KEYS.users, users);
}

export async function getVccPool() {
  return getJson(KEYS.vccPool, []);
}

export async function saveVccPool(vccPool) {
  await setJson(KEYS.vccPool, vccPool);
}

export async function getGuests() {
  return getJson(KEYS.guests, {});
}

export async function saveGuests(guests) {
  await setJson(KEYS.guests, guests);
}

export async function getUsageLogs() {
  return getJson(KEYS.usageLogs, []);
}

export async function saveUsageLogs(usageLogs) {
  await setJson(KEYS.usageLogs, usageLogs);
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

export async function ensureAdminSeed() {
  const users = await getUsers();
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

  await saveUsers([adminUser]);
  return [adminUser];
}

