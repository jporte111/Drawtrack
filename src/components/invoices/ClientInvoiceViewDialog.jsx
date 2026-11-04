import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Send, FileText, Loader2, Download, Link2, ShieldCheck } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import StatusBadge from "@/components/StatusBadge";
import { invoiceStatusConfig } from "@/lib/invoiceStatus";
import { formatCurrency, formatDate } from "@/lib/format";
import { downloadInvoicePdf } from "@/lib/invoicePdf";
import DrawPackageCheck from "./DrawPackageCheck";
import { JLM_SENDER, STANDARD_NOTE } from "@/lib/invoiceEmail";
import { useToast } from "@/components/ui/use-toast";

const REASON_MESSAGES = {
  outlook_not_connected: "Outlook isn't connected, so the invoice can't be emailed right now.",
  no_recipients: "No client contacts with an email address were found for this client.",
  send_failed: "The email could not be sent.",
  invoice_not_found: "This invoice no longer exists.",
  approval_required: "Review the invoice and tick the approval box before sending.",
};

export default function ClientInvoiceViewDialog({ open, onOpenChange, invoice }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selected, setSelected] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [approved, setApproved] = useState(false);
  const [sender, setSender] = useState("");

  const { data: contacts = [] } = useQuery({
    queryKey: ["clientContacts", invoice?.client_id],
    queryFn: () => base44.entities.ClientContact.filter({ client_id: invoice.client_id, active: true }),
    enabled: open && !!invoice?.client_id,
  });

  const emailable = contacts.filter((c) => c.email && String(c.email).includes("@"));

  useEffect(() => {
    if (!open) {
      setError("");
      setSelected([]);
      setApproved(false);
      return;
    }
    setSelected(emailable.filter((c) => c.receives_releases !== false).map((c) => c.email));
    setNote(invoice?.email_note || STANDARD_NOTE);
    setApproved(false);
  }, [open, contacts.length]);

  if (!invoice) return null;

  const toggle = (email) =>
    setSelected((prev) => (prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]));

  const handleSend = async () => {
    setSending(true);
    setError("");
    try {
      const res = await base44.functions.invoke("sendClientInvoice", {
        invoice_id: invoice.id,
        recipients: selected,
        note,
        approved: approved === true,
      });
      const data = res.data || {};
      if (data.ok) {
        setSender(data.sender || "");
        toast({ title: "Invoice sent", description: `Emailed to ${data.recipients.join(", ")}` });
        queryClient.invalidateQueries({ queryKey: ["clientInvoices", invoice.draw_cycle_id] });
        queryClient.invalidateQueries({ queryKey: ["clientInvoices", "client", invoice.client_id] });
        onOpenChange(false);
      } else {
        const base = REASON_MESSAGES[data.reason] || "The invoice could not be sent.";
        setError(data.error ? `${base} ${data.error}` : base);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const handleMarkPaid = async () => {
    await base44.entities.ClientInvoice.update(invoice.id, {
      status: invoice.status === "paid" ? "sent" : "paid",
    });
    queryClient.invalidateQueries({ queryKey: ["clientInvoices", invoice.draw_cycle_id] });
    onOpenChange(false);
  };

  const clientLink = `${window.location.origin}/invoice/${invoice.id}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(clientLink);
    toast({ title: "Client link copied", description: clientLink });
  };

  const items = Array.isArray(invoice.line_items) ? invoice.line_items : [];
  const total = invoice.total != null ? invoice.total : items.reduce((s, i) => s + (Number(i.amount) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Invoice {invoice.invoice_number}
            <StatusBadge status={invoice.status} config={invoiceStatusConfig} />
          </DialogTitle>
        </DialogHeader>

        <div className="border rounded-xl overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 p-5 border-b bg-slate-50">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">Bill To</div>
              <div className="font-medium text-slate-900">{invoice.bill_to_name || "—"}</div>
              {invoice.bill_to_address && <div className="text-sm text-slate-600 whitespace-pre-line">{invoice.bill_to_address}</div>}
              {invoice.bill_to_email && <div className="text-sm text-slate-500">{invoice.bill_to_email}</div>}
            </div>
            <div className="text-sm text-slate-600 sm:text-right">
              <div>Date: {formatDate(invoice.invoice_date)}</div>
              {invoice.project_name && <div className="mt-1 text-slate-500">{invoice.project_name}</div>}
              {invoice.draw_name && <div className="text-slate-500">{invoice.draw_name}</div>}
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-white text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-2.5 font-semibold">Description</th>
                <th className="px-4 py-2.5 font-semibold text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-slate-400">No line items</td>
                </tr>
              ) : (
                items.map((item, index) => (
                  <tr key={index} className="border-b last:border-0">
                    <td className="px-4 py-2.5 text-slate-700">{item.description}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-900">{formatCurrency(item.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="border-t bg-slate-50 font-semibold">
                <td className="px-4 py-3 text-slate-900">Total</td>
                <td className="px-4 py-3 text-right tabular-nums text-slate-900">{formatCurrency(total)}</td>
              </tr>
            </tfoot>
          </table>
          {invoice.notes && <div className="px-4 py-3 text-sm text-slate-600 border-t whitespace-pre-line">{invoice.notes}</div>}
        </div>

        {invoice.sent_at && (
          <p className="text-xs text-slate-500">
            Sent {formatDate(invoice.sent_at)}
            {invoice.sent_to ? ` to ${invoice.sent_to}` : ""}
          </p>
        )}

        <div className="border rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <ShieldCheck className="w-4 h-4 text-slate-400" />Review &amp; approve
          </div>
          <DrawPackageCheck drawCycleId={invoice.draw_cycle_id} />
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">Email note</span>
              <button
                type="button"
                className="text-xs text-blue-600 hover:underline"
                onClick={() => setNote(STANDARD_NOTE)}
              >
                Use standard message
              </button>
            </div>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} />
          </div>
          <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
            <Checkbox checked={approved} onCheckedChange={(v) => setApproved(v === true)} className="mt-0.5" />
            <span>
              I have reviewed this invoice and its supporting documents and approve sending it to the client.
            </span>
          </label>
          <p className="text-xs text-slate-500">
            Sent from the JLM Outlook account ({JLM_SENDER}). Submitting a draw never emails the client — only this approval step does.
          </p>
        </div>

        <div className="border rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <FileText className="w-4 h-4 text-slate-400" />Send to client
          </div>
          {emailable.length === 0 ? (
            <p className="text-sm text-slate-500">
              No client contacts with an email address yet. Add them in Release Contacts for this client.
            </p>
          ) : (
            <div className="space-y-2">
              {emailable.map((contact) => (
                <label key={contact.id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <Checkbox checked={selected.includes(contact.email)} onCheckedChange={() => toggle(contact.email)} />
                  <span>{contact.name || contact.email}</span>
                  <span className="text-slate-400">{contact.email}</span>
                </label>
              ))}
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={handleSend} disabled={sending || selected.length === 0 || !approved}>
              {sending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
              {sending ? "Sending..." : "Approve & Send"}
            </Button>
            <Button size="sm" variant="outline" onClick={handleMarkPaid} disabled={invoice.status === "void"}>
              {invoice.status === "paid" ? "Mark Unpaid" : "Mark Paid"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => downloadInvoicePdf(invoice)}>
              <Download className="w-4 h-4 mr-1.5" />PDF
            </Button>
            <Button size="sm" variant="outline" onClick={copyLink}>
              <Link2 className="w-4 h-4 mr-1.5" />Client Link
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}