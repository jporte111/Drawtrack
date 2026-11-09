import React from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ChevronLeft, Info } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { invoiceRetention } from "@/lib/retention";

export default function Retention() {
  const { clientId } = useParams();

  const { data: client } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => base44.entities.Client.get(clientId),
    enabled: !!clientId,
  });

  const { data: summary, isLoading } = useQuery({
    queryKey: ["retentionSummary", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const [drawsResult, vendors] = await Promise.all([
        base44.entities.DrawCycle.filter({ client_id: clientId }),
        base44.entities.Vendor.list(),
      ]);
      const draws = Array.isArray(drawsResult) ? drawsResult : drawsResult.items;
      const vendorsByDraw = await Promise.all(
        draws.map((d) => base44.entities.DrawVendor.filter({ draw_cycle_id: d.id })),
      );
      const drawVendors = vendorsByDraw.flat();
      const docsResult = await base44.entities.Document.filter({
        document_type: { $in: ["invoice", "receipt"] },
      });
      const docs = Array.isArray(docsResult) ? docsResult : docsResult.items;

      const vendorNames = new Map(vendors.map((v) => [v.id, v.name]));
      const dvById = new Map(drawVendors.map((dv) => [dv.id, dv]));
      const byVendor = new Map();

      for (const doc of docs) {
        const dv = dvById.get(doc.draw_vendor_id);
        if (!dv) continue;
        const name = vendorNames.get(dv.vendor_id) || dv.vendor_name || "Unassigned";
        const key = dv.vendor_id || `name:${name}`;
        const entry =
          byVendor.get(key) || { key, name, gross: 0, retained: 0, net: 0, draws: new Set() };
        const r = invoiceRetention(doc);
        entry.gross += r.gross;
        entry.retained += r.retained;
        entry.net += r.net;
        entry.draws.add(dv.draw_cycle_id);
        byVendor.set(key, entry);
      }

      const rows = [...byVendor.values()]
        .map((e) => ({ ...e, drawCount: e.draws.size }))
        .filter((e) => e.gross > 0)
        .sort((a, b) => b.retained - a.retained || b.gross - a.gross);

      return { rows, trackedDraws: draws.length };
    },
  });

  const rows = summary?.rows || [];
  const totals = rows.reduce(
    (acc, r) => ({ gross: acc.gross + r.gross, retained: acc.retained + r.retained, net: acc.net + r.net }),
    { gross: 0, retained: 0, net: 0 },
  );

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <Link
        to={`/clients/${clientId}/draws`}
        className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 mb-3"
      >
        <ChevronLeft className="w-4 h-4" />Draws
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {client?.name ? `${client.name} — Retention` : "Retention"}
        </h1>
        <p className="text-sm text-slate-500">
          Retention withheld from vendor invoices across every draw, and the amount due at closeout
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <SummaryCard label="Total invoiced" value={totals.gross} />
        <SummaryCard label="Retention held" value={totals.retained} />
        <SummaryCard label="Net paid to vendors" value={totals.net} strong />
      </div>

      {client && !client.retention_enabled && (
        <div className="mb-4 flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          Retention is not enabled for this project. Turn it on in the client settings to withhold a
          percentage on new invoices.
        </div>
      )}

      <div className="overflow-x-auto border rounded-xl">
        <table className="w-full text-sm min-w-[620px]">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
              <th className="px-3 py-2.5 font-semibold">Vendor</th>
              <th className="px-3 py-2.5 font-semibold text-right">Draws</th>
              <th className="px-3 py-2.5 font-semibold text-right">Invoiced</th>
              <th className="px-3 py-2.5 font-semibold text-right">Retention held</th>
              <th className="px-3 py-2.5 font-semibold text-right">Net paid</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-400">Loading...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-400">
                  No vendor invoices on this project yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-medium text-slate-900">{row.name}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{row.drawCount}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{formatCurrency(row.gross)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">{formatCurrency(row.retained)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium text-slate-900">{formatCurrency(row.net)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 bg-slate-100 font-semibold">
              <td className="px-3 py-3 text-slate-900" colSpan={2}>Total</td>
              <td className="px-3 py-3 text-right tabular-nums text-slate-900">{formatCurrency(totals.gross)}</td>
              <td className="px-3 py-3 text-right tabular-nums text-amber-700">{formatCurrency(totals.retained)}</td>
              <td className="px-3 py-3 text-right tabular-nums text-slate-900">{formatCurrency(totals.net)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Invoices recorded before retention was turned on carry no rate, so no retention is counted on
        them. Retention held is the amount still to be paid to each vendor when the job closes out.
      </p>
    </div>
  );
}

function SummaryCard({ label, value, strong }) {
  return (
    <div className={`border rounded-lg p-4 ${strong ? "bg-slate-900 border-slate-900" : "bg-white"}`}>
      <div className={`text-xs ${strong ? "text-slate-300" : "text-slate-500"}`}>{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${strong ? "text-white" : "text-slate-900"}`}>
        {formatCurrency(value || 0)}
      </div>
    </div>
  );
}