import React from "react";
import { formatCurrency } from "@/lib/format";

export default function CategoryTotals({ rows, grandTotal }) {
  if (rows.length === 0) return null;

  return (
    <div className="mt-4 border rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b">
        <h3 className="text-sm font-semibold text-slate-900">Totals by Category</h3>
      </div>
      <div className="divide-y">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center justify-between px-4 py-2 text-sm">
            <div className="flex items-baseline gap-2">
              <span className="text-slate-700">{r.name}</span>
              <span className="text-xs text-slate-400">
                {r.count} {r.count === 1 ? "line" : "lines"}
              </span>
            </div>
            <div className="tabular-nums font-medium text-slate-900">{formatCurrency(r.total)}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between px-4 py-2.5 border-t bg-slate-50 text-sm font-semibold">
        <span className="text-slate-900">Total</span>
        <span className="tabular-nums text-slate-900">{formatCurrency(grandTotal)}</span>
      </div>
    </div>
  );
}