import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from "@/components/StatusBadge";
import { priorityConfig } from "@/lib/statusConfig";
import { formatDate } from "@/lib/format";

const PRIORITIES = ["low", "medium", "high", "critical"];

export default function OpenItemDetailDialog({ item, vendorName, open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [priority, setPriority] = useState(item?.priority);

  React.useEffect(() => {
    if (open) setPriority(item?.priority);
  }, [open, item]);

  if (!item) return null;

  const handlePriorityChange = async (value) => {
    setPriority(value);
    await base44.entities.OpenItem.update(item.id, { priority: value });
    queryClient.invalidateQueries({ queryKey: ["openItems", item.draw_cycle_id] });
    queryClient.invalidateQueries({ queryKey: ["openItems", "all"] });
  };

  const handleResolve = async () => {
    await base44.entities.OpenItem.update(item.id, {
      status: "resolved",
      resolved_date: new Date().toISOString().split("T")[0],
    });
    queryClient.invalidateQueries({ queryKey: ["openItems", item.draw_cycle_id] });
    queryClient.invalidateQueries({ queryKey: ["openItems", "all"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StatusBadge status={priority} config={priorityConfig} />
            {item.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Vendor</div>
              <div className="font-medium text-slate-900">{vendorName || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Assignee</div>
              <div className="font-medium text-slate-900">{item.assigned_to || "Unassigned"}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Due Date</div>
              <div className="font-medium text-slate-900">{formatDate(item.due_date)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Priority</div>
              <Select value={priority} onValueChange={handlePriorityChange}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Status</div>
              <div className="font-medium text-slate-900 capitalize">{item.status.replace(/_/g, " ")}</div>
            </div>
          </div>
          {item.description && (
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wide mb-1">Notes</div>
              <div className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-md p-3 border">{item.description}</div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {(item.status === "open" || item.status === "in_progress") && (
            <Button onClick={handleResolve}>Mark Resolved</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}