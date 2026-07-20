import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const TITLE_MAP = {
  invoice: "Missing invoice",
  conditional_lien_release: "Missing conditional lien release",
  unconditional_lien_release: "Missing unconditional lien release",
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { document_id, draw_vendor_id, document_type } = body;

    if (!document_id || !draw_vendor_id) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Avoid duplicates: skip if an active open item already exists for this document
    const existing = await base44.asServiceRole.entities.OpenItem.filter({ document_id });
    const hasActive = existing.some((i) => i.status === "open" || i.status === "in_progress");
    if (hasActive) {
      return Response.json({ success: true, message: "Active open item already exists", skipped: true });
    }

    // Look up the DrawVendor to get the draw_cycle_id
    const drawVendor = await base44.asServiceRole.entities.DrawVendor.get(draw_vendor_id);

    const title = TITLE_MAP[document_type] || "Missing document";
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