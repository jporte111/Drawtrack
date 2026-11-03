import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Download, CreditCard, CheckCircle2 } from "lucide-react";
import { downloadInvoicePdf } from "@/lib/invoicePdf";
import { formatCurrency, formatDate } from "@/lib/format";

const COMPANY = "JLM Development Inc.";

export default function PublicInvoice() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await base44.functions.invoke("getClientInvoice", { invoice_id: id });
        const data = res.data || {};
        if (!active) return;
        if (data.invoice) setInvoice(data.invoice);
        else setNotFound(true);
      } catch {
        if (active) setNotFound(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (loading || !notFound) return;
    const meta = document.createElement("meta");
    meta.name = "prerender-status-code";
    meta.content = "404";
    document.head.appendChild(meta);
    return () => document.head.removeChild(meta);
  }, [loading, notFound]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-900 mb-1">Invoice not found</h1>
          <p className="text-sm text-slate-500">This invoice link may be incorrect or the invoice was deleted.</p>
        </div>
      </div>
    );
  }

  const items = Array.isArray(invoice.line_items) ? invoice.line_items : [];
  const total = invoice.total != null ? invoice.total : items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const isPaid = invoice.status === "paid";

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
          <div className="bg-slate-900 text-white px-6 py-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">{COMPANY}</div>
              <div className="text-sm text-slate-300 mt-0.5">Invoice {invoice.invoice_number}</div>
            </div>
            <div className="sm:text-right">
              <div className="text-2xl font-bold tracking-tight">INVOICE</div>
              <div className="text-sm text-slate-300 mt-0.5">{formatDate(invoice.invoice_date)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 px-6 py-6 border-b">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Bill To</div>
              <div className="font-medium text-slate-900">{invoice.bill_to_name || "—"}</div>
              {invoice.bill_to_address && (
                <div className="text-sm text-slate-600 whitespace-pre-line">{invoice.bill_to_address}</div>
              )}
              {invoice.bill_to_email && <div className="text-sm text-slate-500">{invoice.bill_to_email}</div>}
            </div>
            <div className="text-sm text-slate-600 sm:text-right space-y-1">
              <div><span className="text-slate-500">Invoice #:</span> {invoice.invoice_number}</div>
              <div><span className="text-slate-500">Date:</span> {formatDate(invoice.invoice_date)}</div>
              <div><span className="text-slate-500">Due:</span> {formatDate(invoice.due_date)}</div>
              {invoice.project_name && <div><span className="text-slate-500">Project:</span> {invoice.project_name}</div>}
              {invoice.draw_name && <div><span className="text-slate-500">Draw:</span> {invoice.draw_name}</div>}
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-6 py-2.5 font-semibold">Description</th>
                <th className="px-6 py-2.5 font-semibold text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-6 py-6 text-center text-slate-400">No line items</td>
                </tr>
              ) : (
                items.map((item, index) => (
                  <tr key={index} className="border-b last:border-0">
                    <td className="px-6 py-3 text-slate-700">{item.description}</td>
                    <td className="px-6 py-3 text-right tabular-nums text-slate-900">{formatCurrency(item.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="border-t bg-slate-50">
                <td className="px-6 py-4 font-semibold text-slate-900">Total Due</td>
                <td className="px-6 py-4 text-right tabular-nums text-lg font-semibold text-slate-900">{formatCurrency(total)}</td>
              </tr>
            </tfoot>
          </table>

          {invoice.notes && <div className="px-6 py-4 border-t text-sm text-slate-600 whitespace-pre-line">{invoice.notes}</div>}

          {(invoice.pay_url || invoice.payment_instructions) && (
            <div className="px-6 py-5 border-t bg-slate-50">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Payment</div>
              {invoice.payment_instructions && (
                <p className="text-sm text-slate-600 whitespace-pre-line mb-3">{invoice.payment_instructions}</p>
              )}
              {invoice.pay_url && !isPaid && (
                <Button asChild>
                  <a href={invoice.pay_url} target="_blank" rel="noopener noreferrer">
                    <CreditCard className="w-4 h-4 mr-2" />Pay {formatCurrency(total)} Online
                  </a>
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => downloadInvoicePdf(invoice)}>
              <Download className="w-4 h-4 mr-2" />Download PDF
            </Button>
            <Button variant="outline" onClick={() => window.print()}>Print</Button>
          </div>
          {isPaid && (
            <div className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />Paid in full
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Invoice {invoice.invoice_number} from {COMPANY}
        </p>
      </div>
    </div>
  );
}