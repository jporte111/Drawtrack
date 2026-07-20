import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { document_id } = body;

    if (!document_id) {
      return Response.json({ error: "Missing document_id" }, { status: 400 });
    }

    // Find open items linked to this document
    const openItems = await base44.asServiceRole.entities.OpenItem.filter({ document_id });
    const today = new Date().toISOString().split("T")[0];

    let resolved = 0;
    for (const item of openItems) {
      if (item.status === "open" || item.status === "in_progress") {
        await base44.asServiceRole.entities.OpenItem.update(item.id, {
          status: "resolved",
          resolved_date: today,
        });
        resolved++;
      }
    }

    return Response.json({ success: true, resolved });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});