const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

export function json(statusCode, payload) {
  return {
    statusCode,
    headers: JSON_HEADERS,
    body: JSON.stringify(payload)
  };
}

export function methodNotAllowed(allowed) {
  return json(405, {
    ok: false,
    message: `Method not allowed. Use: ${allowed.join(", ")}`
  });
}

export function badRequest(message) {
  return json(400, { ok: false, message });
}

export function unauthorized(message = "Unauthorized") {
  return json(401, { ok: false, message });
}

export function forbidden(message = "Forbidden") {
  return json(403, { ok: false, message });
}

export function parseBody(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    throw new Error("Invalid JSON body");
  }
}

export function getClientIp(event) {
  if (!event || !event.headers) return "unknown";
  const headers = event.headers;
  const ip = headers["x-nf-client-connection-ip"] ||
             headers["X-Nf-Client-Connection-Ip"] ||
             headers["client-ip"] ||
             headers["Client-Ip"] ||
             headers["x-forwarded-for"] ||
             headers["X-Forwarded-For"] ||
             event.requestContext?.identity?.sourceIp;
  if (!ip) return "unknown";
  return ip.split(",")[0].trim();
}


