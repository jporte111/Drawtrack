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

    return Response.json({ success: true, submittedName: newName, nextDraw, skippedNext: hasOpenDraft });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}