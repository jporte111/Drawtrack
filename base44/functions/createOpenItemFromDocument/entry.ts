import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const DOC_LABELS = {
  invoice: "Invoice",
  conditional_lien_release: "Conditional lien release",
  unconditional_lien_release: "Unconditional lien release",
};

const STATUS_LABELS = {
  missing: "Missing",
  pending_signature: "Pending signature",
  needs_correction: "Needs correction",
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { document_id, draw_vendor_id, document_type, status } = body;

    if (!document_id || !draw_vendor_id) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const docLabel = DOC_LABELS[document_type] || "Document";
    const statusLabel = STATUS_LABELS[status] || "Unresolved";

    // Fetch the document to get the amount for a more descriptive title
    let amountLabel = "";
    try {
      const doc = await base44.asServiceRole.entities.Document.get(document_id);
      if (doc && doc.amount != null) {
        const formatted = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(doc.amount);
        amountLabel = ` — ${formatted}`;
      }
    } catch (_e) {
      // If document fetch fails, continue without the amount
    }

    const title = `${statusLabel}: ${docLabel}${amountLabel}`;

    // Look up the DrawVendor to get the draw_cycle_id
    const drawVendor = await base44.asServiceRole.entities.DrawVendor.get(draw_vendor_id);

    // Check for existing active open items for this document
    const existing = await base44.asServiceRole.entities.OpenItem.filter({ document_id });
    const activeItems = existing.filter((i) => i.status === "open" || i.status === "in_progress");

    if (activeItems.length > 0) {
      // Update the title of existing items to reflect the current status
      for (const item of activeItems) {
        await base44.asServiceRole.entities.OpenItem.update(item.id, { title });
      }
      return Response.json({ success: true, message: "Updated existing open item title", skipped: true });
    }

    await base44.asServiceRole.entities.OpenItem.create({
      draw_cycle_id: drawVendor.draw_cycle_id,
      draw_vendor_id: draw_vendor_id,
      document_id: document_id,
      title: title,
      priority: "medium",
      status: "open",
    });

    return Response.json({ success: true, title });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});