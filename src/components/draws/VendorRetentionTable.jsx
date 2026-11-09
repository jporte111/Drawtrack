import React from "react";
import { formatCurrency } from "@/lib/format";

export default function VendorRetentionTable({ rows = [] }) {
  const totals = rows.reduce(
    (acc, r) => ({
      gross: acc.gross + r.gross,
      retained: acc.retained + r.retained,
      net: acc.net + r.net,
    }),
    { gross: 0, retained: 0, net: 0 },
  );

  return (
    <div className="mt-4">
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-slate-900">Retention by vendor</h3>
        <p className="text-xs text-slate-500">
          Gross invoiced, retention withheld and the net amount paid for this draw
        </p>
      </div>
      <div className="overflow-x-auto border rounded-xl">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
              <th className="px-3 py-2.5 font-semibold">Vendor</th>
              <th className="px-3 py-2.5 font-semibold text-right">Invoiced</th>
              <th className="px-3 py-2.5 font-semibold text-right">Retention held</th>
              <th className="px-3 py-2.5 font-semibold text-right">Net paid</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                  No invoices on this draw yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="px-3 py-2.5 font-medium text-slate-900">{row.name}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{formatCurrency(row.gross)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{formatCurrency(row.retained)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium text-slate-900">{formatCurrency(row.net)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 bg-slate-100 font-semibold">
              <td className="px-3 py-3 text-slate-900">Total</td>
              <td className="px-3 py-3 text-right tabular-nums text-slate-900">{formatCurrency(totals.gross)}</td>
              <td className="px-3 py-3 text-right tabular-nums text-slate-900">{formatCurrency(totals.retained)}</td>
              <td className="px-3 py-3 text-right tabular-nums text-slate-900">{formatCurrency(totals.net)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}