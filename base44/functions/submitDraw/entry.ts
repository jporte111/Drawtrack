import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { draw_cycle_id } = body;
    if (!draw_cycle_id) return Response.json({ error: "Missing draw_cycle_id" }, { status: 400 });

    const draw = await base44.entities.DrawCycle.get(draw_cycle_id);
    if (!draw) return Response.json({ error: "Draw not found" }, { status: 404 });

    // Build a date-based name from draw_date (or today), parsed without timezone shifting
    const dateStr = draw.draw_date || new Date().toISOString().slice(0, 10);
    const [y, mo, da] = dateStr.split("-").map(Number);
    const yy = String(y).slice(2);
    const dateObj = new Date(Date.UTC(y, mo - 1, da));
    const weekday = dateObj.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
    const newName = `Draw ${weekday} ${mo}/${da}/${yy}`;

    await base44.entities.DrawCycle.update(draw_cycle_id, { name: newName, status: "submitted" });

    // Create the master draw invoice (skipped if this draw already has a live invoice)
    const clientInvoice = await createDrawInvoice(base44, draw, newName);

    // Spawn the next "Next Draw" only if no other draft/in_progress draw exists for this client
    const draws = await base44.entities.DrawCycle.filter({ client_id: draw.client_id });
    const hasOpenDraft = draws.some(
      (x) => x.id !== draw_cycle_id && (x.status === "draft" || x.status === "in_progress")
    );
    let nextDraw = null;
    if (!hasOpenDraft) {
      nextDraw = await base44.entities.DrawCycle.create({
        client_id: draw.client_id,
        name: "Next Draw",
        project_name: draw.project_name,
        status: "draft",
        draw_manager: draw.draw_manager,
        approver: draw.approver,
        approval_status: "not_required",
      });
    }

    return Response.json({ success: true, submittedName: newName, nextDraw, skippedNext: hasOpenDraft, clientInvoice });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

const PAYMENT_INSTRUCTIONS = [
  "Zelle: 323-842-6955",
  "",
  "ACH/Wire:",
  "JLM Development Inc",
  "Chase Bank",
  "270 Park Ave., New York, NY 10017",
  "Acct: 157782563",
  "ACH Rtg: 322271627",
  "Wire Rtg: 021000021",
  "International SWIFT/BIC: CHASUS33",
].join("\n");

async function createDrawInvoice(base44: any, draw: any, drawName: string) {
  const existing = await base44.entities.ClientInvoice.filter({ draw_cycle_id: draw.id });
  if (existing.some((inv: any) => inv.status !== "void")) return null;

  const [drawVendors, budgetCategories, clients, allInvoices] = await Promise.all([
    base44.entities.DrawVendor.filter({ draw_cycle_id: draw.id }),
    base44.entities.BudgetCategory.filter({ client_id: draw.client_id }),
    base44.entities.Client.filter({ id: draw.client_id }),
    base44.entities.ClientInvoice.list(),
  ]);
  const client = clients[0] || null;

  const docs = drawVendors.length
    ? await base44.entities.Document.filter({ draw_vendor_id: { $in: drawVendors.map((dv: any) => dv.id) } })
    : [];

  const catById = new Map(budgetCategories.map((c: any) => [c.id, c]));
  const docsByVendor = new Map<string, any[]>();
  for (const doc of docs) {
    if (doc.document_type !== "invoice" && doc.document_type !== "receipt") continue;
    if (!docsByVendor.has(doc.draw_vendor_id)) docsByVendor.set(doc.draw_vendor_id, []);
    docsByVendor.get(doc.draw_vendor_id).push(doc);
  }

  // Group the draw's charges by budget category, matching the draw ledger
  const groups = new Map<string, { name: string; sort: number; amount: number }>();
  const addTo = (categoryId: string, value: any) => {
    const amount = Number(value) || 0;
    if (!amount) return;
    const cat = categoryId ? catById.get(categoryId) : null;
    const key = cat ? cat.id : "__uncategorized__";
    if (!groups.has(key)) {
      groups.set(key, { name: cat?.name || "Uncategorized", sort: cat?.sort_order ?? 9999, amount: 0 });
    }
    groups.get(key).amount += amount;
  };

  for (const dv of drawVendors) {
    const invoices = docsByVendor.get(dv.id) || [];
    if (invoices.length) {
      for (const inv of invoices) addTo(inv.budget_category_id || dv.budget_category_id, inv.amount);
    } else {
      addTo(dv.budget_category_id, dv.amount);
    }
  }

  let lineItems = [...groups.values()]
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name))
    .map((g) => ({ description: g.name, amount: Math.round(g.amount * 100) / 100 }));

  if (lineItems.length === 0) {
    const fallback = Number(draw.amount) || 0;
    if (!fallback) return null;
    lineItems = [{ description: drawName, amount: fallback }];
  }

  const total = Math.round(lineItems.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;

  const numbers = allInvoices
    .map((inv: any) => parseInt(String(inv.invoice_number || "").replace(/[^0-9]/g, ""), 10))
    .filter((n: number) => Number.isFinite(n));
  const nextNumber = String((numbers.length ? Math.max(...numbers) : 1000) + 1);

  const today = new Date().toISOString().slice(0, 10);

  return await base44.entities.ClientInvoice.create({
    client_id: draw.client_id,
    draw_cycle_id: draw.id,
    invoice_number: nextNumber,
    invoice_date: today,
    status: "draft",
    bill_to_name: client?.name || "",
    bill_to_email: "",
    bill_to_address: client?.address || "",
    project_name: draw.project_name || client?.project_name || "",
    draw_name: drawName,
    line_items: lineItems,
    total,
    notes: draw.project_name || client?.project_name || "",
    payment_instructions: PAYMENT_INSTRUCTIONS,
  });
}