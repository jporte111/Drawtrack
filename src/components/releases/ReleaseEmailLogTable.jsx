import React from "react";

const STATUS_STYLES = {
  sent: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  duplicate: "bg-amber-100 text-amber-700",
  previewed: "bg-slate-100 text-slate-600",
};

function formatWhen(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function ReleaseEmailLogTable({ logs = [], showClient = false, isLoading = false }) {
  if (isLoading) {
    return <div className="px-4 py-8 text-center text-sm text-slate-400">Loading...</div>;
  }
  if (logs.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-sm text-slate-400">
        No release emails yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[720px]">
        <thead>
          <tr className="border-b bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
            <th className="px-4 py-2.5 font-semibold">When</th>
            {showClient && <th className="px-4 py-2.5 font-semibold">Client</th>}
            <th className="px-4 py-2.5 font-semibold">Vendor / Invoice</th>
            <th className="px-4 py-2.5 font-semibold">Recipients</th>
            <th className="px-4 py-2.5 font-semibold">Status</th>
            <th className="px-4 py-2.5 font-semibold">Details</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b last:border-0 align-top">
              <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{formatWhen(log.sent_at || log.created_date)}</td>
              {showClient && <td className="px-4 py-2.5 text-slate-900 font-medium">{log.client_name || "—"}</td>}
              <td className="px-4 py-2.5 text-slate-700">
                <div>{log.vendor_name || "—"}</div>
                <div className="text-xs text-slate-500">
                  {log.invoice_number ? `Invoice ${log.invoice_number}` : ""}
                  {log.draw_cycle_name ? ` · ${log.draw_cycle_name}` : ""}
                </div>
              </td>
              <td className="px-4 py-2.5 text-slate-600 max-w-[240px] break-words">{log.recipients || "—"}</td>
              <td className="px-4 py-2.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[log.status] || STATUS_STYLES.previewed}`}>
                  {log.status}
                </span>
              </td>
              <td className="px-4 py-2.5 text-slate-600 max-w-[320px]">
                <div className="truncate" title={log.subject}>{log.subject || "—"}</div>
                {log.error_message && <div className="text-xs text-red-600 mt-0.5">{log.error_message}</div>}
                {log.status === "duplicate" && <div className="text-xs text-amber-600 mt-0.5">Already sent — skipped</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}