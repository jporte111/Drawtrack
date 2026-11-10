import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Plus, Pencil, ExternalLink, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import BudgetCategoryDialog from "./BudgetCategoryDialog";

const ACTIVE_STATUSES = ["draft", "in_progress", "submitted", "under_review"];

export default function BudgetMatrix({ clientId, budgetId, budgetSourceUrl }) {
  const { data: categories = [] } = useQuery({
    queryKey: ["budgetCategories", budgetId],
    queryFn: () => base44.entities.BudgetCategory.filter({ budget_id: budgetId }),
    enabled: !!budgetId,
  });
  const { data: drawCycles = [] } = useQuery({
    queryKey: ["draws", clientId],
    queryFn: () => base44.entities.DrawCycle.filter({ client_id: clientId }),
  });
  const { data: allDrawVendors = [] } = useQuery({
    queryKey: ["drawVendorsAll"],
    queryFn: () => base44.entities.DrawVendor.list(null, 500),
  });
  const { data: allDocs = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: () => base44.entities.Document.list(null, 500),
  });

  const [catDialogOpen, setCatDialogOpen] = React.useState(false);
  const [editingCat, setEditingCat] = React.useState(null);

  const derived = useMemo(() => {
    const draws = [...drawCycles].sort(
      (a, b) => new Date(a.created_date) - new Date(b.created_date)
    );
    const drawIds = new Set(draws.map((d) => d.id));
    const drawVendors = allDrawVendors.filter((dv) => drawIds.has(dv.draw_cycle_id));
    const dvIds = new Set(drawVendors.map((dv) => dv.id));
    const invoices = allDocs.filter(
      (d) => dvIds.has(d.draw_vendor_id) && (d.document_type === "invoice" || d.document_type === "receipt")
    );

    const dvById = new Map(drawVendors.map((dv) => [dv.id, dv]));
    const matrix = {}; // categoryId -> drawId -> { approved, pending }
    const uncategorized = {}; // drawId -> { approved, pending }
    for (const cat of categories) matrix[cat.id] = {};
    for (const inv of invoices) {
      const dv = dvById.get(inv.draw_vendor_id);
      if (!dv) continue;
      const drawId = dv.draw_cycle_id;
      // The invoice's own category wins, so budget totals always match the draw ledger.
      const catId = inv.budget_category_id || dv.budget_category_id;
      const target = catId && matrix[catId] ? matrix[catId] : uncategorized;
      if (!target[drawId]) target[drawId] = { approved: 0, pending: 0 };
      const amt = inv.amount || 0;
      if (inv.review_status === "approved") target[drawId].approved += amt;
      else if (inv.review_status === "needs_review") target[drawId].pending += amt;
    }

    const sortedCategories = [...categories].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    return { draws, sortedCategories, matrix, uncategorized, hasUncategorized: Object.keys(uncategorized).length > 0 };
  }, [categories, drawCycles, allDrawVendors, allDocs]);

  const { draws, sortedCategories, matrix, uncategorized, hasUncategorized } = derived;

  const cellTotal = (catId, drawId, field) => {
    const row = catId ? matrix[catId]?.[drawId] : uncategorized[drawId];
    return row?.[field] || 0;
  };

  const categorySpent = (catId) =>
    draws.reduce((sum, d) => sum + cellTotal(catId, d.id, "approved"), 0);
  const categoryPending = (catId) =>
    draws.reduce((sum, d) => sum + cellTotal(catId, d.id, "pending"), 0);
  const categoryBudget = (cat) => (cat?.revised_budget != null ? cat.revised_budget : cat?.original_budget) || 0;

  const drawApprovedTotal = (drawId) =>
    sortedCategories.reduce((sum, c) => sum + cellTotal(c.id, drawId, "approved"), 0) +
    (uncategorized[drawId]?.approved || 0);
  const drawPendingTotal = (drawId) =>
    sortedCategories.reduce((sum, c) => sum + cellTotal(c.id, drawId, "pending"), 0) +
    (uncategorized[drawId]?.pending || 0);

  const grandBudget = sortedCategories.reduce((sum, c) => sum + categoryBudget(c), 0);
  const grandSpent = sortedCategories.reduce((sum, c) => sum + categorySpent(c.id), 0);
  const grandPending = sortedCategories.reduce((sum, c) => sum + categoryPending(c.id), 0);

  const openEdit = (cat) => { setEditingCat(cat); setCatDialogOpen(true); };
  const openNew = () => { setEditingCat(null); setCatDialogOpen(true); };

  if (!budgetId) {
    return (
      <div className="text-center py-16 text-slate-400 border border-dashed rounded-xl">
        <p>Select or create a budget to begin.</p>
      </div>
    );
  }

  if (sortedCategories.length === 0 && !hasUncategorized) {
    return (
      <div className="text-center py-16 text-slate-400 border border-dashed rounded-xl">
        <p className="mb-3">No budget categories yet.</p>
        <Button onClick={openNew} size="sm"><Plus className="w-4 h-4 mr-1" />Add Category</Button>
        <BudgetCategoryDialog
          open={catDialogOpen} onOpenChange={setCatDialogOpen}
          budgetId={budgetId} clientId={clientId} category={editingCat}
          nextSort={sortedCategories.length}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-500">
          Approved invoice amounts feed this budget automatically. "Pending" = needs-review invoices (not yet counted in totals).
        </p>
        <Button onClick={openNew} size="sm" variant="outline"><Plus className="w-4 h-4 mr-1" />Add Category</Button>
      </div>

      <div className="overflow-x-auto border rounded-xl">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
              <th className="px-4 py-3 font-semibold sticky left-0 bg-slate-50">Category</th>
              <th className="px-4 py-3 font-semibold text-right">Updated Budget</th>
              {draws.map((d) => (
                <th key={d.id} className="px-4 py-3 font-semibold text-right whitespace-nowrap">
                  <div className="flex flex-col items-end">
                    <span className="text-slate-700 normal-case font-medium">{d.name}</span>
                    <span className={`text-[10px] ${ACTIVE_STATUSES.includes(d.status) ? "text-emerald-600" : "text-slate-400"}`}>
                      {ACTIVE_STATUSES.includes(d.status) ? "Active" : d.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 font-semibold text-right bg-slate-100">Total Spent</th>
              <th className="px-4 py-3 font-semibold text-right bg-slate-100">Remaining</th>
              <th className="px-2 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {sortedCategories.map((cat) => {
              const spent = categorySpent(cat.id);
              const pending = categoryPending(cat.id);
              const budget = categoryBudget(cat);
              const remaining = budget - spent;
              return (
                <tr key={cat.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-900 sticky left-0 bg-white">
                    {cat.name}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-700 tabular-nums">{formatCurrency(budget)}</td>
                  {draws.map((d) => {
                    const approved = cellTotal(cat.id, d.id, "approved");
                    const pend = cellTotal(cat.id, d.id, "pending");
                    return (
                      <td key={d.id} className="px-4 py-2.5 text-right tabular-nums">
                        {approved > 0 ? (
                          <span className="text-slate-900">{formatCurrency(approved)}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                        {pend > 0 && (
                          <div className="text-[11px] text-amber-600">+{formatCurrency(pend)} pend</div>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums bg-slate-50">{formatCurrency(spent)}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold tabular-nums bg-slate-50 ${remaining < 0 ? "text-red-600" : "text-slate-900"}`}>
                    {formatCurrency(remaining)}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-slate-700" onClick={() => openEdit(cat)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}

            {hasUncategorized && (
              <tr className="border-b last:border-0 bg-amber-50/60">
                <td className="px-4 py-2.5 font-medium text-amber-800 sticky left-0 bg-amber-50/60 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Uncategorized
                </td>
                <td className="px-4 py-2.5 text-right text-slate-400">—</td>
                {draws.map((d) => {
                  const approved = uncategorized[d.id]?.approved || 0;
                  const pend = uncategorized[d.id]?.pending || 0;
                  return (
                    <td key={d.id} className="px-4 py-2.5 text-right tabular-nums">
                      {approved > 0 ? <span className="text-amber-800">{formatCurrency(approved)}</span> : <span className="text-slate-300">—</span>}
                      {pend > 0 && <div className="text-[11px] text-amber-600">+{formatCurrency(pend)} pend</div>}
                    </td>
                  );
                })}
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums bg-amber-100/60">
                  {formatCurrency(draws.reduce((s, d) => s + (uncategorized[d.id]?.approved || 0), 0))}
                </td>
                <td className="px-4 py-2.5 text-right text-slate-400 bg-amber-100/60">—</td>
                <td className="px-2 py-2.5"></td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 bg-slate-100 font-semibold">
              <td className="px-4 py-3 text-slate-900 sticky left-0 bg-slate-100">Grand Total</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(grandBudget)}</td>
              {draws.map((d) => (
                <td key={d.id} className="px-4 py-3 text-right tabular-nums">
                  {formatCurrency(drawApprovedTotal(d.id))}
                  {drawPendingTotal(d.id) > 0 && (
                    <div className="text-[11px] font-normal text-amber-600">+{formatCurrency(drawPendingTotal(d.id))} pend</div>
                  )}
                </td>
              ))}
              <td className="px-4 py-3 text-right tabular-nums bg-slate-200">{formatCurrency(grandSpent)}</td>
              <td className={`px-4 py-3 text-right tabular-nums bg-slate-200 ${grandBudget - grandSpent < 0 ? "text-red-600" : ""}`}>
                {formatCurrency(grandBudget - grandSpent)}
              </td>
              <td className="px-2 py-3"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {grandPending > 0 && (
        <p className="text-xs text-amber-600 mt-2">
          {formatCurrency(grandPending)} in needs-review invoices pending approval (not included in totals above).
        </p>
      )}

      <BudgetCategoryDialog
        open={catDialogOpen} onOpenChange={setCatDialogOpen}
        budgetId={budgetId} clientId={clientId} category={editingCat}
        nextSort={sortedCategories.length}
      />
    </div>
  );
}