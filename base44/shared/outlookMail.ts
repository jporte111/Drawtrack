export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function formatMoney(value) {
  const n = Number(value);
  if (!isFinite(n)) return "";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function formatDateValue(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function collectEmails(values, options = {}) {
  const exclude = (options.exclude || []).map((e) => String(e).toLowerCase());
  const seen = new Set();
  const out = [];
  for (const raw of values || []) {
    const email = String(raw || "").trim();
    if (!EMAIL_RE.test(email)) continue;
    const key = email.toLowerCase();
    if (seen.has(key) || exclude.includes(key)) continue;
    seen.add(key);
    out.push(email);
  }
  return out;
}

export function toBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function graphRequest(accessToken, path, options = {}) {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...options,
    signal: AbortSignal.timeout(30000),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Graph API error: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}