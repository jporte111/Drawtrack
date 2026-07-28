import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, ChevronDown, ChevronRight } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { priorityConfig, openItemDocTypeConfig } from "@/lib/statusConfig";
import { formatDate, formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import OpenItemFormDialog from "./OpenItemFormDialog";
import OpenItemDetailDialog from "./OpenItemDetailDialog";
import EditableAmount from "./EditableAmount";
import { Trash2, ExternalLink } from "lucide-react";

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

export default function OpenItemsSection({ drawId }) {
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [expandedVendors, setExpandedVendors] = useState({});
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
  const { data: allDocs = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: () => base44.entities.Document.list(),
  });

  // Auto-refresh when the workflow creates/resolves open items
  useEffect(() => {
    const unsubscribe = base44.entities.OpenItem.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ["openItems", drawId] });
    });
    return unsubscribe;
  }, [drawId, queryClient]);

  const vendorNameByDV = useMemo(() => {
    const vendorMap = new Map(vendors.map((v) => [v.id, v.name]));
    return new Map(drawVendors.map((dv) => [dv.id, vendorMap.get(dv.vendor_id) || "Unknown"]));
  }, [drawVendors, vendors]);

  const docById = useMemo(() => {
    return new Map(allDocs.map((d) => [d.id, d]));
  }, [allDocs]);

  const unresolved = items.filter((i) => i.status === "open" || i.status === "in_progress");

  // Group by draw_vendor_id, sort items within each group by priority
  const vendorGroups = useMemo(() => {
    const groups = new Map();
    for (const item of unresolved) {
      const key = item.draw_vendor_id || "__unassigned";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    for (const [, groupItems] of groups) {
      groupItems.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9));
    }
    return [...groups.entries()];
  }, [unresolved]);

  const toggleVendor = (key) => {
    setExpandedVendors((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleItemClick = (item) => {
    setSelectedItem(item);
    setDetailOpen(true);
  };

  const handleDetailClose = (v) => {
    setDetailOpen(v);
    if (!v) setSelectedItem(null);
  };

  const getHighestPriority = (groupItems) => {
    return groupItems.reduce((highest, item) => {
      if (!highest) return item.priority;
      return (PRIORITY_ORDER[item.priority] ?? 9) < (PRIORITY_ORDER[highest] ?? 9)
        ? item.priority
        : highest;
    }, null);
  };

  const getOutstandingDocTypes = (groupItems) => {
    const types = new Set();
    for (const item of groupItems) {
      const doc = item.document_id ? docById.get(item.document_id) : null;
      if (doc?.document_type) types.add(doc.document_type);
    }
    return [...types];
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Open Items</h2>
          <p className="text-sm text-slate-500">
            {unresolved.length} active {unresolved.length === 1 ? "item" : "items"} across {vendorGroups.length}{" "}
            {vendorGroups.length === 1 ? "vendor" : "vendors"}
          </p>
        </div>
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus className="w-4 h-4 mr-1" />Add Item
        </Button>
      </div>
      {vendorGroups.length === 0 ? (
        <div className="text-center py-8 text-slate-400 border border-dashed rounded-lg">
          No open items for this draw.
        </div>
      ) : (
        <div className="space-y-2">
          {vendorGroups.map(([vendorKey, groupItems]) => {
            const vendorName =
              vendorKey === "__unassigned" ? "Unassigned" : vendorNameByDV.get(vendorKey) || "Unknown";
            const isExpanded = expandedVendors[vendorKey];
            const highestPriority = getHighestPriority(groupItems);
            const docTypes = getOutstandingDocTypes(groupItems);
            return (
              <div key={vendorKey} className="border border-slate-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleVendor(vendorKey)}
                  className="w-full flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-slate-900 truncate">{vendorName}</div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {docTypes.map((dt) => {
                      const cfg = openItemDocTypeConfig[dt];
                      if (!cfg) return null;
                      return (
                        <span
                          key={dt}
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
                            cfg.className
                          )}
                        >
                          {cfg.label}
                        </span>
                      );
                    })}
                  </div>
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-slate-200 text-slate-700 text-xs font-semibold shrink-0">
                    {groupItems.length}
                  </span>
                  {highestPriority && <StatusBadge status={highestPriority} config={priorityConfig} />}
                </button>
                {isExpanded && (
                  <div className="divide-y divide-slate-100">
                    {groupItems.map((item) => {
                      const doc = item.document_id ? docById.get(item.document_id) : null;
                      const docType = doc?.document_type || null;
                      const docTypeCfg = docType ? openItemDocTypeConfig[docType] : null;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleItemClick(item)}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 pl-10 hover:bg-slate-50 cursor-pointer transition-colors",
                            docTypeCfg?.borderClass ? `border-l-4 ${docTypeCfg.borderClass}` : "border-l-4 border-l-transparent"
                          )}
                        >
                          <StatusBadge status={item.priority} config={priorityConfig} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-slate-900 truncate">{item.title}</div>
                          </div>
                          {doc && (
                            <div className="shrink-0">
                              <EditableAmount
                                amount={doc.amount}
                                className="text-xs text-slate-600"
                                onSave={async (newAmount) => {
                                  await base44.entities.Document.update(doc.id, { amount: newAmount });
                                  queryClient.invalidateQueries({ queryKey: ["documents"] });
                                }}
                              />
                            </div>
                          )}
                          {doc?.file_url && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-slate-400 hover:text-slate-700 shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(doc.file_url, "_blank", "noopener,noreferrer");
                              }}
                              title="View invoice"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {item.assigned_to && (
                            <span className="text-xs text-slate-500 hidden sm:block">{item.assigned_to}</span>
                          )}
                          {item.due_date && (
                            <span className="text-xs text-slate-500 hidden md:block">
                              Due {formatDate(item.due_date)}
                            </span>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-slate-400 hover:text-red-600 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              base44.entities.OpenItem.delete(item.id).then(() => {
                                queryClient.invalidateQueries({ queryKey: ["openItems", drawId] });
                              });
                            }}
                            title="Delete item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
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