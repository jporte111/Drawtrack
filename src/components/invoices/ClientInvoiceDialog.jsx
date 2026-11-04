import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";

function buildLines({ drawVendors, vendors, documents, categories }) {
  const vendorMap = new Map(vendors.map((v) => [v.id, v.name]));
  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const dvIds = new Set(drawVendors.map((dv) => dv.id));
  const docsByDV = {};
  documents.forEach((doc) => {
    if (doc.document_type !== "invoice" && doc.document_type !== "receipt") return;
    if (!dvIds.has(doc.draw_vendor_id)) return;
    (docsByDV[doc.draw_vendor_id] ||= []).push(doc);
  });

  const lines = [];
  drawVendors.forEach((dv) => {
    const vendorName = vendorMap.get(dv.vendor_id) || "Vendor";
    const docs = docsByDV[dv.id] || [];
    if (docs.length > 0) {
      docs.forEach((doc) => {
        const category = catMap.get(doc.budget_category_id || dv.budget_category_id) || "";
        const invoiceRef = doc.invoice_number ? `Invoice ${doc.invoice_number}` : "";
        lines.push({
          description: [vendorName, category, invoiceRef].filter(Boolean).join(" — "),
          amount: doc.amount != null ? String(doc.amount) : "",
        });
      });
    } else if (dv.amount) {
      const category = catMap.get(dv.budget_category_id) || "";
      lines.push({
        description: [vendorName, category].filter(Boolean).join(" — "),
        amount: String(dv.amount),
      });
    }
  });
  return lines;
}

function nextInvoiceNumber(invoices) {
  const numbers = (invoices || [])
    .map((inv) => parseInt(String(inv.invoice_number || "").replace(/[^0-9]/g, ""), 10))
    .filter((n) => Number.isFinite(n));
  return String((numbers.length ? Math.max(...numbers) : 1000) + 1);
}

export default function ClientInvoiceDialog({ open, onOpenChange, drawId, invoice }) {
  const isEdit = !!invoice;
  const queryClient = useQueryClient();
  const initialized = useRef(false);
  const [saving, setSaving] = useState(false);
  const [numbering, setNumbering] = useState("auto");
  const [form, setForm] = useState({
    invoice_number: "",
    invoice_date: "",
    bill_to_name: "",
    bill_to_email: "",
    bill_to_address: "",
    notes: "",
    pay_url: "",
    payment_instructions: "",
    line_items: [{ description: "", amount: "" }],
  });

  const { data: draw } = useQuery({
    queryKey: ["draw", drawId],
    queryFn: () => base44.entities.DrawCycle.get(drawId),
    enabled: open && !!drawId,
  });
  const { data: client } = useQuery({
    queryKey: ["client", draw?.client_id],
    queryFn: () => base44.entities.Client.get(draw.client_id),
    enabled: open && !!draw?.client_id,
  });
  const { data: drawVendors = [] } = useQuery({
    queryKey: ["drawVendors", drawId],
    queryFn: () => base44.entities.DrawVendor.filter({ draw_cycle_id: drawId }),
    enabled: open && !!drawId,
  });
  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => base44.entities.Vendor.list(),
    enabled: open,
  });
  const { data: documents = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: () => base44.entities.Document.list(),
    enabled: open,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["budgetCategories", draw?.client_id],
    queryFn: () => base44.entities.BudgetCategory.filter({ client_id: draw.client_id }),
    enabled: open && !!draw?.client_id,
  });
  const { data: clientInvoices = [] } = useQuery({
    queryKey: ["clientInvoices", "client", draw?.client_id],
    queryFn: () => base44.entities.ClientInvoice.filter({ client_id: draw.client_id }),
    enabled: open && !!draw?.client_id,
  });
  const { data: contacts = [] } = useQuery({
    queryKey: ["clientContacts", draw?.client_id],
    queryFn: () => base44.entities.ClientContact.filter({ client_id: draw.client_id, active: true }),
    enabled: open && !!draw?.client_id,
  });

  const billingEmail = (contacts.find((c) => c.email && c.receives_releases !== false) || {}).email || "";

  useEffect(() => {
    if (!open) {
      initialized.current = false;
      return;
    }
    if (initialized.current) return;
    if (isEdit) {
      initialized.current = true;
      setNumbering("manual");
      setForm({
        invoice_number: invoice.invoice_number || "",
        invoice_date: invoice.invoice_date || "",
        bill_to_name: invoice.bill_to_name || "",
        bill_to_email: invoice.bill_to_email || "",
        bill_to_address: invoice.bill_to_address || "",
        notes: invoice.notes || "",
        pay_url: invoice.pay_url || "",
        payment_instructions: invoice.payment_instructions || "",
        line_items:
          Array.isArray(invoice.line_items) && invoice.line_items.length > 0
            ? invoice.line_items.map((li) => ({
                description: li.description || "",
                amount: li.amount != null ? String(li.amount) : "",
              }))
            : [{ description: "", amount: "" }],
      });
      return;
    }
    if (!draw || !client) return;
    initialized.current = true;

    const lines = buildLines({ drawVendors, vendors, documents, categories });
    setNumbering("auto");
    setForm({
      invoice_number: nextInvoiceNumber(clientInvoices),
      invoice_date: new Date().toISOString().slice(0, 10),
      bill_to_name: client.name || "",
      bill_to_email: billingEmail,
      bill_to_address: client.address || "",
      notes: "",
      pay_url: "",
      payment_instructions: "",
      line_items: lines.length > 0 ? lines : [{ description: "", amount: "" }],
    });
  }, [open, isEdit, invoice, draw, client, drawVendors, vendors, documents, categories, clientInvoices, billingEmail]);

  const total = form.line_items.reduce((sum, li) => sum + (Number(li.amount) || 0), 0);

  const setLine = (index, patch) => {
    setForm((prev) => ({
      ...prev,
      line_items: prev.line_items.map((li, i) => (i === index ? { ...li, ...patch } : li)),
    }));
  };

  const addLine = () => setForm((prev) => ({ ...prev, line_items: [...prev.line_items, { description: "", amount: "" }] }));

  const removeLine = (index) =>
    setForm((prev) => ({
      ...prev,
      line_items: prev.line_items.length === 1 ? prev.line_items : prev.line_items.filter((_, i) => i !== index),
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        client_id: draw?.client_id || invoice?.client_id,
        draw_cycle_id: drawId || invoice?.draw_cycle_id,
        draw_name: draw?.name || invoice?.draw_name || "",
        project_name: draw?.project_name || invoice?.project_name || "",
        invoice_number: form.invoice_number.trim(),
        invoice_date: form.invoice_date || "",
        bill_to_name: form.bill_to_name,
        bill_to_email: form.bill_to_email,
        bill_to_address: form.bill_to_address,
        notes: form.notes,
        pay_url: form.pay_url,
        payment_instructions: form.payment_instructions,
        line_items: form.line_items.map((li) => ({
          description: li.description || "",
          amount: Number(li.amount) || 0,
        })),
        total,
      };
      if (isEdit) {
        await base44.entities.ClientInvoice.update(invoice.id, payload);
      } else {
        await base44.entities.ClientInvoice.create({ ...payload, status: "draft" });
      }
      queryClient.invalidateQueries({ queryKey: ["clientInvoices", drawId] });
      queryClient.invalidateQueries({ queryKey: ["clientInvoices", "client", payload.client_id] });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Client Invoice" : "New Client Invoice"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Invoice #</Label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setNumbering("auto");
                      setForm((prev) => ({ ...prev, invoice_number: nextInvoiceNumber(clientInvoices) }));
                    }}
                    className={`h-6 rounded px-2 text-xs font-medium ${numbering === "auto" ? "bg-slate-900 text-white" : "border text-slate-600"}`}
                  >
                    Automatic
                  </button>
                  <button
                    type="button"
                    onClick={() => setNumbering("manual")}
                    className={`h-6 rounded px-2 text-xs font-medium ${numbering === "manual" ? "bg-slate-900 text-white" : "border text-slate-600"}`}
                  >
                    Manual
                  </button>
                </div>
              </div>
              <Input
                value={form.invoice_number}
                onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                disabled={numbering === "auto"}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Invoice Date</Label>
              <Input type="date" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Bill To</Label>
              <Input value={form.bill_to_name} onChange={(e) => setForm({ ...form, bill_to_name: e.target.value })} placeholder="Client name" />
            </div>
            <div className="space-y-1.5">
              <Label>Billing Email</Label>
              <Input type="email" value={form.bill_to_email} onChange={(e) => setForm({ ...form, bill_to_email: e.target.value })} placeholder="Optional" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Billing Address</Label>
            <Input value={form.bill_to_address} onChange={(e) => setForm({ ...form, bill_to_address: e.target.value })} placeholder="Project address" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Line Items</Label>
              <Button type="button" size="sm" variant="outline" onClick={addLine}>
                <Plus className="w-4 h-4 mr-1" />Add Line
              </Button>
            </div>
            <div className="space-y-2">
              {form.line_items.map((line, index) => (
                <div key={index} className="flex items-start gap-2">
                  <Input
                    value={line.description}
                    onChange={(e) => setLine(index, { description: e.target.value })}
                    placeholder="Description"
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    value={line.amount}
                    onChange={(e) => setLine(index, { amount: e.target.value })}
                    placeholder="0.00"
                    className="w-32 text-right tabular-nums"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLine(index)}
                    disabled={form.line_items.length === 1}
                    className="text-slate-400 hover:text-red-600 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-3 pt-2 border-t">
              <span className="text-sm text-slate-500">Total</span>
              <span className="text-lg font-semibold tabular-nums text-slate-900">{formatCurrency(total)}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Optional note printed on the invoice" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Online Payment Link</Label>
              <Input
                value={form.pay_url}
                onChange={(e) => setForm({ ...form, pay_url: e.target.value })}
                placeholder="https://..."
              />
              <p className="text-xs text-slate-500">Shown as a "Pay Online" button on the client's invoice.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Payment Instructions</Label>
              <Textarea
                value={form.payment_instructions}
                onChange={(e) => setForm({ ...form, payment_instructions: e.target.value })}
                rows={3}
                placeholder="e.g. Check payable to JLM Development Inc., mailed to..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : isEdit ? "Save Changes" : "Create Invoice"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}