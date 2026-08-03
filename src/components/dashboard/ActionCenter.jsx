import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const ACTIVE_STATUSES = ["draft", "in_progress", "submitted", "under_review"];

const DOC_TYPE_LABELS = {
  invoice: "Invoice",
  receipt: "Receipt",
  conditional_lien_release: "Conditional Lien Release",
  unconditional_lien_release: "Unconditional Lien Release",
};

export default function ActionCenter() {
  const { data: drawCycles = [] } = useQuery({
    queryKey: ["drawCycles"],
    queryFn: () => base44.entities.DrawCycle.list(),
  });
  const { data: drawVendors = [] } = useQuery({
    queryKey: ["drawVendorsAll"],
    queryFn: () => base44.entities.DrawVendor.list(),
  });
  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => base44.entities.Vendor.list(),
  });
  const { data: documents = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: () => base44.entities.Document.list(),
  });

  const vendorMap = new Map(vendors.map((v) => [v.id, v]));
  const cycleMap = new Map(drawCycles.map((c) => [c.id, c]));
  const activeCycleIds = new Set(
    drawCycles.filter((c) => ACTIVE_STATUSES.includes(c.status)).map((c) => c.id)
  );
  const dvByCycle = new Map();
  drawVendors.forEach((dv) => {
    if (activeCycleIds.has(dv.draw_cycle_id)) {
      if (!dvByCycle.has(dv.draw_cycle_id)) dvByCycle.set(dv.draw_cycle_id, []);
      dvByCycle.get(dv.draw_cycle_id).push(dv);
    }
  });

  const items = [];
  documents.forEach((doc) => {
    if (doc.status !== "missing" && doc.status !== "needs_correction") return;
    const dv = drawVendors.find((d) => d.id === doc.draw_vendor_id);
    if (!dv || !activeCycleIds.has(dv.draw_cycle_id)) return;
    const vendor = vendorMap.get(dv.vendor_id);
    const cycle = cycleMap.get(dv.draw_cycle_id);
    items.push({
      id: `${doc.id}`,
      vendorName: vendor?.name || "Unknown vendor",
      drawName: cycle?.name || "Unknown draw",
      projectName: cycle?.project_name || "",
      docType: DOC_TYPE_LABELS[doc.document_type] || doc.document_type,
      status: doc.status,
      drawId: dv.draw_cycle_id,
    });
  });

  items.sort((a, b) => {
    if (a.status !== b.status) return a.status === "needs_correction" ? -1 : 1;
    return a.drawName.localeCompare(b.drawName);
  });

  return (
    <div className="bg-white border rounded-xl p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        <h2 className="text-lg font-semibold text-slate-900">Action Center</h2>
        <span className="text-sm text-slate-400">({items.length} needing attention)</span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-400 py-6 text-center">
          No documents need attention right now. All caught up!
        </p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 border rounded-lg px-3 py-2.5 hover:bg-slate-50"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-900 truncate">{item.vendorName}</div>
                <div className="text-xs text-slate-500 truncate">
                  {item.drawName}
                  {item.projectName ? ` · ${item.projectName}` : ""}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm text-slate-700">{item.docType}</div>
                <div
                  className={`text-xs font-medium ${
                    item.status === "needs_correction" ? "text-amber-600" : "text-red-500"
                  }`}
                >
                  {item.status === "needs_correction" ? "Needs correction" : "Missing"}
                </div>
              </div>
              <Link to={`/draws/${item.drawId}`} className="shrink-0">
                <Button variant="outline" size="sm" className="gap-1">
                  Open <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}