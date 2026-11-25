// Draw invoices are always sent from the JLM address.
export const JLM_SENDER = "JLM@namastefinancialmgmt.com";

// Public JLM mark, used in the invoice email and on generated PDFs.
export const JLM_LOGO_URL =
  "https://media.base44.com/images/public/6a5e7a0a5cbf866d6d105ac4/b6abab716da4ae93c448a4922b08af69_JLM-logo-email.png";

// First name of the person the invoice is addressed to: the client contact
// marked as owner, else the first named contact, else the bill-to name.
export function primaryFirstName(contacts = [], invoice) {
  const named = (contacts || []).filter((c) => c.name && String(c.name).trim());
  const preferred = named.find((c) => c.role === "owner") || named[0];
  const raw = preferred?.name || invoice?.bill_to_name || "";
  const first = String(raw).trim().split(/\s+/)[0] || "";
  return /^[A-Za-z]/.test(first) ? first : "";
}

export function standardNote(firstName) {
  const greeting = firstName ? `Hello ${firstName},` : "Hello,";
  return [
    greeting,
    "",
    "Attached is the current draw invoice for your review. It lists the work completed to date by budget category. Also attached are the supporting vendor invoices for this draw and the budget progress report.",
    "",
    "Please let us know if you have any questions or if anything needs clarification. Payment is due upon receipt.",
    "",
    "Thank you,",
  ].join("\n");
}