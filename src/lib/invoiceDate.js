import { base44 } from "@/api/base44Client";

const DATE_SCHEMA = {
  type: "object",
  properties: {
    invoice_date: {
      type: "string",
      description:
        "The invoice date printed on the document, formatted YYYY-MM-DD. Use the invoice/service date, not a due date. Empty string if no date is printed.",
    },
  },
};

// Accepts 2026-11-05, 11/05/2026, 11-5-26 or a written date, and always returns YYYY-MM-DD.
export function normalizeInvoiceDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const us = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (us) {
    const year = us[3].length === 2 ? `20${us[3]}` : us[3];
    return `${year}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  }
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return "";
}

// Reads the date printed on an uploaded invoice file. Returns "" when none is found.
export async function readInvoiceDate(fileUrl) {
  if (!fileUrl) return "";
  const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
    file_url: fileUrl,
    json_schema: DATE_SCHEMA,
  });
  if (result?.status !== "success") return "";
  return normalizeInvoiceDate(result.output?.invoice_date);
}