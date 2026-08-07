import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Plus, ChevronRight, ChevronLeft, FileWarning, DollarSign, FolderOpen, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";
import DrawFormDialog from "@/components/draws/DrawFormDialog";
import DrawActionsMenu from "@/components/draws/DrawActionsMenu";

export default function DrawList() {
  const { clientId } = useParams();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: client } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => base44.entities.Client.get(clientId),
    enabled: !!clientId,
  });
  const { data: draws = [], isLoading } = useQuery({
    queryKey: ["draws", clientId],
    queryFn: () => base44.entities.DrawCycle.filter({ client_id: clientId }),
  });
  const { data: openItems = [] } = useQuery({
    queryKey: ["openItems", "all"],
    queryFn: () => base44.entities.OpenItem.list(),
  });

  const activeDraws = draws.filter((d) => d.status !== "closed").length;
  const totalAmount = draws.reduce((sum, d) => sum + (d.amount || 0), 0);
  const drawIds = new Set(draws.map((d) => d.id));
  const activeItems = openItems.filter((i) => drawIds.has(i.draw_cycle_id) && (i.status === "open" || i.status === "in_progress")).length;
  const openByDraw = openItems.reduce((acc, i) => {
    if (drawIds.has(i.draw_cycle_id) && (i.status === "open" || i.status === "in_progress")) {
      acc[i.draw_cycle_id] = (acc[i.draw_cycle_id] || 0) + 1;
    }
    return acc;
  }, {});

  const stats = [
    { label: "Total Draws", value: draws.length, icon: ClipboardList },
    { label: "Active", value: activeDraws, icon: FolderOpen },
    { label: "Total Value", value: formatCurrency(totalAmount), icon: DollarSign },
    { label: "Pending Items", value: activeItems, icon: FileWarning },
  ];

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <Link to="/" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 mb-3">
        <ChevronLeft className="w-4 h-4" />All Clients
      </Link>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{client?.name || "Draws"}</h1>
          <p className="text-sm text-slate-500">Draw cycles for {client?.name || "this client"}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="shrink-0"><Plus className="w-4 h-4 mr-1.5" />New Draw</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="bg-white border rounded-xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-500">{s.label}</span>
              <s.icon className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-xl font-bold text-slate-900">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="bg-white border rounded-xl overflow-hidden hidden md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-slate-50 text-left">
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Draw</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Project</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Amount</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Pending Items</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
            ) : draws.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">No draw cycles yet. Click "New Draw" to get started.</td></tr>
            ) : (
              draws.map((draw) => (
                <tr key={draw.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/draws/${draw.id}`} className="font-medium text-slate-900 hover:text-blue-600">{draw.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{draw.project_name}</td>
                  <td className="px-4 py-3"><StatusBadge status={draw.status} /></td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formatDate(draw.draw_date)}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 text-right">{formatCurrency(draw.amount)}</td>
                  <td className="px-4 py-3 text-center">
                    {openByDraw[draw.id] ? (
                      <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">{openByDraw[draw.id]}</span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link to={`/draws/${draw.id}`} className="inline-flex items-center text-slate-400 hover:text-slate-700">
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                      <DrawActionsMenu draw={draw} clientId={clientId} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {isLoading ? (
          <div className="text-center py-8 text-slate-400">Loading...</div>
        ) : draws.length === 0 ? (
          <div className="text-center py-12 text-slate-400 border border-dashed rounded-xl">No draw cycles yet. Click "New Draw" to get started.</div>
        ) : (
          draws.map((draw) => (
            <div key={draw.id} className="bg-white border rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <Link to={`/draws/${draw.id}`} className="font-medium text-slate-900 hover:text-blue-600">{draw.name}</Link>
                <div className="flex items-center gap-1">
                  <StatusBadge status={draw.status} />
                  <DrawActionsMenu draw={draw} clientId={clientId} />
                </div>
              </div>
              <div className="text-sm text-slate-600 mb-2">{draw.project_name}</div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{formatDate(draw.draw_date)}</span>
                <span className="font-medium text-slate-900">{formatCurrency(draw.amount)}</span>
              </div>
              {openByDraw[draw.id] > 0 && (
                <div className="mt-2">
                  <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">{openByDraw[draw.id]} pending items</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <DrawFormDialog open={dialogOpen} onOpenChange={setDialogOpen} clientId={clientId} />
    </div>
  );
}