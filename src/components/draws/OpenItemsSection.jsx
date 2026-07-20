import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { priorityConfig } from "@/lib/statusConfig";
import { formatDate } from "@/lib/format";
import OpenItemFormDialog from "./OpenItemFormDialog";

const ITEM_STATUSES = ["open", "in_progress", "resolved", "closed"];
const STATUS_ORDER = { open: 0, in_progress: 1, resolved: 2, closed: 3 };

export default function OpenItemsSection({ drawId }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ["openItems", drawId],
    queryFn: () => base44.entities.OpenItem.filter({ draw_cycle_id: drawId }),
  });

  const sorted = [...items].sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));
  const activeCount = items.filter((i) => i.status === "open" || i.status === "in_progress").length;

  const handleStatusChange = async (itemId, status) => {
    await base44.entities.OpenItem.update(itemId, {
      status,
      resolved_date: status === "resolved" ? new Date().toISOString().split("T")[0] : null,
    });
    queryClient.invalidateQueries({ queryKey: ["openItems", drawId] });
    queryClient.invalidateQueries({ queryKey: ["openItems", "all"] });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Open Items</h2>
          <p className="text-sm text-slate-500">{activeCount} active {activeCount === 1 ? "item" : "items"}</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-1" />Add Item</Button>
      </div>
      {sorted.length === 0 ? (
        <div className="text-center py-8 text-slate-400 border border-dashed rounded-lg">No open items for this draw.</div>
      ) : (
        <div className="space-y-2">
          {sorted.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-3 bg-slate-50 border rounded-lg">
              <StatusBadge status={item.priority} config={priorityConfig} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-slate-900 truncate">{item.title}</div>
                {item.description && <div className="text-xs text-slate-500 truncate">{item.description}</div>}
              </div>
              {item.assigned_to && <span className="text-xs text-slate-500 hidden sm:block">{item.assigned_to}</span>}
              {item.due_date && <span className="text-xs text-slate-500 hidden md:block">Due {formatDate(item.due_date)}</span>}
              <Select value={item.status} onValueChange={(v) => handleStatusChange(item.id, v)}>
                <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ITEM_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}
      <OpenItemFormDialog open={dialogOpen} onOpenChange={setDialogOpen} drawId={drawId} />
    </div>
  );
}