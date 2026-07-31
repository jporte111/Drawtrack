import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const DOC_LABELS = {
  invoice: "Invoice",
  receipt: "Receipt",
  conditional_lien_release: "Conditional lien release",
  unconditional_lien_release: "Unconditional lien release",
};

const STATUS_LABELS = {
  missing: "Missing",
  pending_signature: "Pending signature",
  needs_correction: "Needs correction",
  pending_payment: "Pending payment",
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { document_id, draw_vendor_id, draw_cycle_id, document_type, status, amount } = body;

    if (!document_id || !draw_vendor_id || !draw_cycle_id) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const docLabel = DOC_LABELS[document_type] || "Document";
    const statusLabel = STATUS_LABELS[status] || "Unresolved";

    let amountLabel = "";
    const amt = amount != null ? Number(amount) : null;
    if (amt != null && !isNaN(amt)) {
      amountLabel = ` — ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amt)}`;
    }

    const title = `${statusLabel}: ${docLabel}${amountLabel}`;

    // User-scoped, RLS-enforced: only the authenticated caller's accessible items are visible
    const existing = await base44.entities.OpenItem.filter({ document_id });
    const activeItems = existing.filter((i) => i.status === "open" || i.status === "in_progress");

    if (activeItems.length > 0) {
      for (const item of activeItems) {
        await base44.entities.OpenItem.update(item.id, { title });
      }
      return Response.json({ success: true, message: "Updated existing open item title", skipped: true });
    }

    await base44.entities.OpenItem.create({
      draw_cycle_id,
      draw_vendor_id,
      document_id,
      title,
      priority: "medium",
      status: "open",
    });

    return Response.json({ success: true, title });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});