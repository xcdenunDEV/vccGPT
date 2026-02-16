import crypto from "node:crypto";

function padMonth(month) {
  return String(month).padStart(2, "0");
}

export function parseVccLine(line) {
  if (!line || typeof line !== "string") return null;
  const clean = line.trim();
  if (!clean) return null;
  const [numberRaw, monthRaw, yearRaw, cvvRaw] = clean.split("|").map((part) => part.trim());
  if (!numberRaw || !monthRaw || !yearRaw || !cvvRaw) return null;
  if (!/^\d{13,19}$/.test(numberRaw)) return null;
  if (!/^\d{1,2}$/.test(monthRaw)) return null;
  if (!/^\d{4}$/.test(yearRaw)) return null;
  if (!/^\d{3,4}$/.test(cvvRaw)) return null;

  const monthNumber = Number(monthRaw);
  if (monthNumber < 1 || monthNumber > 12) return null;

  return {
    id: crypto.randomUUID(),
    number: numberRaw,
    month: padMonth(monthNumber),
    year: yearRaw,
    cvv: cvvRaw,
    used: false,
    usedAt: null,
    usedById: null,
    usedByType: null,
    createdAt: new Date().toISOString()
  };
}

export function maskCardNumber(number) {
  const digits = String(number || "").replace(/\D/g, "");
  if (digits.length < 10) return "****";
  return `${digits.slice(0, 6)}******${digits.slice(-4)}`;
}

