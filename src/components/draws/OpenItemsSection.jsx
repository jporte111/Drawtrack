import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { priorityConfig } from "@/lib/statusConfig";
import { formatDate } from "@/lib/format";
import OpenItemFormDialog from "./OpenItemFormDialog";
import OpenItemDetailDialog from "./OpenItemDetailDialog";

export default function OpenItemsSection({ drawId }) {
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const queryClient = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ["openItems", drawId],
    queryFn: () => base44.entities.OpenItem.filter({ draw_cycle_id: drawId }),
  });
  const { data: drawVendors = [] } = useQuery({
    queryKey: ["drawVendors", drawId],
    queryFn: () => base44.entities.DrawVendor.filter({ draw_cycle_id: drawId }),
  });
  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => base44.entities.Vendor.list(),
  });

  const vendorNameByDV = useMemo(() => {
    const vendorMap = new Map(vendors.map((v) => [v.id, v.name]));
    return new Map(drawVendors.map((dv) => [dv.id, vendorMap.get(dv.vendor_id) || "Unknown"]));
  }, [drawVendors, vendors]);

  const unresolved = items.filter((i) => i.status === "open" || i.status === "in_progress");
  const sorted = [...unresolved].sort((a, b) => {
    const order = { open: 0, in_progress: 1 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9);
  });

  const handleItemClick = (item) => {
    setSelectedItem(item);
    setDetailOpen(true);
  };

  const handleDetailClose = (v) => {
    setDetailOpen(v);
    if (!v) setSelectedItem(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Open Items</h2>
          <p className="text-sm text-slate-500">{sorted.length} active {sorted.length === 1 ? "item" : "items"}</p>
        </div>
        <Button size="sm" onClick={() => setFormOpen(true)}><Plus className="w-4 h-4 mr-1" />Add Item</Button>
      </div>
      {sorted.length === 0 ? (
        <div className="text-center py-8 text-slate-400 border border-dashed rounded-lg">No open items for this draw.</div>
      ) : (
        <div className="space-y-2">
          {sorted.map((item) => (
            <div
              key={item.id}
              onClick={() => handleItemClick(item)}
              className="flex items-center gap-3 p-3 bg-slate-50 border rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
            >
              <StatusBadge status={item.priority} config={priorityConfig} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-slate-900 truncate">{item.title}</div>
                {item.draw_vendor_id && (
                  <div className="text-xs text-slate-500 truncate">{vendorNameByDV.get(item.draw_vendor_id) || "—"}</div>
                )}
              </div>
              {item.assigned_to && <span className="text-xs text-slate-500 hidden sm:block">{item.assigned_to}</span>}
              {item.due_date && <span className="text-xs text-slate-500 hidden md:block">Due {formatDate(item.due_date)}</span>}
            </div>
          ))}
        </div>
      )}
      <OpenItemFormDialog open={formOpen} onOpenChange={setFormOpen} drawId={drawId} />
      <OpenItemDetailDialog
        item={selectedItem}
        vendorName={selectedItem?.draw_vendor_id ? vendorNameByDV.get(selectedItem.draw_vendor_id) : null}
        open={detailOpen}
        onOpenChange={handleDetailClose}
      />
    </div>
  );
}