import { base44 } from "@/api/base44Client";
import { retentionPatch } from "@/lib/retention";

// Suggest a category from the project's own Schedule of Values only.
// Returns { categoryId, matched } — never invents a category.
export async function categorizeExpense({ categories, fileUrl, description }) {
  const list = categories.map((c) => `${c.id}: ${c.name}`).join("\n");
  if (!list) return { categoryId: null, matched: false };

  const prompt = `You are categorizing a construction draw expense into the project's budget categories (Schedule of Values).

The ONLY valid categories are listed below as "id: name":
${list}

Rules:
- Choose a category only when the expense clearly belongs to one of the listed categories.
- Never invent a new category, never return a name that is not in the list.
- Similar wording counts as a match: "Roof progress" is the Roof category, "Portable sanitation" and "Site sanitation" are the same sanitation category.
- If nothing in the list is a confident match, return category_id = null.

Expense description (may be empty): ${description || "(not provided)"}

Return JSON: category_id = the id of the best matching category from the list above, or null. confidence = "high", "medium" or "low".`;

  const schema = {
    type: "object",
    properties: {
      category_id: { type: ["string", "null"] },
      confidence: { type: ["string", "null"] },
    },
  };

  const res = fileUrl
    ? await base44.integrations.Core.InvokeLLM({ prompt, file_urls: [fileUrl], response_json_schema: schema })
    : await base44.integrations.Core.InvokeLLM({ prompt, response_json_schema: schema });

  const id = res?.category_id;
  const valid = id && categories.some((c) => c.id === id) ? id : null;
  return { categoryId: valid, confidence: res?.confidence || null };
}

// Reuse an existing master vendor when the name matches, otherwise create one.
export async function resolveMasterVendor({ vendorName, clientId }) {
  const name = String(vendorName || "").trim();
  if (!name) return null;

  const vendors = await base44.entities.Vendor.list();
  const exact = vendors.find((v) => String(v.name || "").trim().toLowerCase() === name.toLowerCase());
  const vendor =
    exact ||
    (await base44.entities.Vendor.create({ name, vendor_type: "other", status: "active" }));

  if (clientId) {
    const links = await base44.entities.ClientVendor.filter({ client_id: clientId, vendor_id: vendor.id });
    if (links.length === 0) {
      await base44.entities.ClientVendor.create({ client_id: clientId, vendor_id: vendor.id, status: "active" });
    }
  }
  return vendor;
}

// A charge is one DrawVendor row plus exactly one invoice document, so a
// supporting invoice can be attached later to the same charge.
export async function createCharge({
  drawId,
  clientId,
  vendorId,
  vendorName,
  budgetCategoryId,
  description,
  amount,
  fileUrl,
  invoiceNumber,
  invoiceDate,
  reviewNeeded,
}) {
  let finalVendorId = vendorId || null;
  let finalVendorName = String(vendorName || "").trim();

  if (!finalVendorId && finalVendorName) {
    const vendor = await resolveMasterVendor({ vendorName: finalVendorName, clientId });
    finalVendorId = vendor?.id || null;
    finalVendorName = vendor?.name || finalVendorName;
  }

  const drawVendor = await base44.entities.DrawVendor.create({
    draw_cycle_id: drawId,
    vendor_id: finalVendorId,
    vendor_name: finalVendorName,
    scope_of_work: description || "",
    budget_category_id: budgetCategoryId || "",
    amount: amount != null ? Number(amount) : null,
    status: "pending",
  });

  const client = clientId ? await base44.entities.Client.get(clientId) : null;
  const retention = client?.retention_enabled
    ? retentionPatch(amount, client.retention_rate ?? 10)
    : {};

  const today = new Date().toISOString().slice(0, 10);
  await base44.entities.Document.create({
    draw_vendor_id: drawVendor.id,
    document_type: "invoice",
    status: fileUrl ? "complete" : "missing",
    review_status: reviewNeeded ? "needs_review" : "approved",
    file_url: fileUrl || null,
    amount: amount != null ? Number(amount) : null,
    ...retention,
    invoice_number: invoiceNumber || "",
    invoice_date: invoiceDate || "",
    received_date: fileUrl ? today : "",
    budget_category_id: budgetCategoryId || "",
    source: "manual",
  });

  return drawVendor;
}