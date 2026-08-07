import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import InvoiceItem from "./InvoiceItem";

export default function AddVendorDialog({ open, onOpenChange, drawId, clientId }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ vendor_id: "", scope_of_work: "", notes: "" });
  const [invoices, setInvoices] = useState([]);
  const [extracted, setExtracted] = useState(false);
  const [showNewVendor, setShowNewVendor] = useState(false);
  const [newVendorName, setNewVendorName] = useState("");
  const [creatingVendor, setCreatingVendor] = useState(false);

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => base44.entities.Vendor.list(),
  });
  const { data: drawVendors = [] } = useQuery({
    queryKey: ["drawVendors", drawId],
    queryFn: () => base44.entities.DrawVendor.filter({ draw_cycle_id: drawId }),
  });
  const { data: clientVendors = [] } = useQuery({
    queryKey: ["clientVendors", clientId],
    queryFn: () => base44.entities.ClientVendor.filter({ client_id: clientId }),
    enabled: !!clientId,
  });

  const linkedIds = new Set(drawVendors.map((dv) => dv.vendor_id));
  const clientLinkedIds = new Set(clientVendors.map((cv) => cv.vendor_id));
  const availableVendors = vendors.filter((v) => !linkedIds.has(v.id) && clientLinkedIds.has(v.id));
  const ensureClientLink = async (vendorId) => {
    if (!clientId || clientLinkedIds.has(vendorId)) return;
    await base44.entities.ClientVendor.create({ client_id: clientId, vendor_id: vendorId, status: "active" });
    queryClient.invalidateQueries({ queryKey: ["clientVendors", clientId] });
  };

  useEffect(() => {
    if (open) {
      setForm({ vendor_id: "", scope_of_work: "", notes: "" });
      setInvoices([]);
      setExtracted(false);
      setShowNewVendor(false);
      setNewVendorName("");
    }
  }, [open]);

  const handleCreateVendor = async () => {
    if (!newVendorName.trim()) return;
    setCreatingVendor(true);
    try {
      const newVendor = await base44.entities.Vendor.create({
        name: newVendorName.trim(),
        vendor_type: "other",
        status: "active",
        client_id: clientId,
      });
      if (clientId) {
        await base44.entities.ClientVendor.create({ client_id: clientId, vendor_id: newVendor.id, status: "active" });
        queryClient.invalidateQueries({ queryKey: ["clientVendors", clientId] });
      }
      queryClient.setQueryData(["vendors"], (old = []) => [...old, newVendor]);
      setForm((f) => ({ ...f, vendor_id: newVendor.id }));
      setShowNewVendor(false);
      setNewVendorName("");
    } finally {
      setCreatingVendor(false);
    }
  };

  const totalAmount = invoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);

  const handleAddInvoice = () => {
    setInvoices((prev) => [...prev, { file_url: "", filename: "", amount: "", uploading: false, error: "", doc_type: "invoice" }]);
  };

  const handleInvoiceChange = (index, updated) => {
    setInvoices((prev) => prev.map((inv, i) => (i === index ? updated : inv)));
  };

  const handleInvoiceRemove = (index) => {
    setInvoices((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFirstInvoiceExtracted = async (data) => {
    if (!data || Object.keys(data).length === 0) {
      setExtracted(true);
      return;
    }
    setExtracted(true);
    setForm((f) => ({
      ...f,
      scope_of_work: data.scope_of_work || f.scope_of_work,
    }));

    if (data.vendor_name) {
      const lower = data.vendor_name.toLowerCase();
      const existing = vendors.find(
        (v) => v.name.toLowerCase().includes(lower) || lower.includes(v.name.toLowerCase())
      );
      if (existing) {
        setForm((f) => ({ ...f, vendor_id: existing.id }));
        await ensureClientLink(existing.id);
      } else {
        const newVendor = await base44.entities.Vendor.create({
          name: data.vendor_name,
          contact_name: data.contact_name || "",
          email: data.email || "",
          phone: data.phone || "",
          address: data.address || "",
          tax_id: data.tax_id || "",
          vendor_type: "other",
          status: "active",
          client_id: clientId,
        });
        if (clientId) {
          await base44.entities.ClientVendor.create({ client_id: clientId, vendor_id: newVendor.id, status: "active" });
          queryClient.invalidateQueries({ queryKey: ["clientVendors", clientId] });
        }
        queryClient.setQueryData(["vendors"], (old = []) => [...old, newVendor]);
        setForm((f) => ({ ...f, vendor_id: newVendor.id }));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const dv = await base44.entities.DrawVendor.create({
        draw_cycle_id: drawId,
        vendor_id: form.vendor_id,
        scope_of_work: form.scope_of_work,
        amount: totalAmount || null,
        notes: form.notes,
        status: "pending",
      });

      const today = new Date().toISOString().split("T")[0];
      const uploadedInvoices = invoices.filter((inv) => inv.file_url);
      const createdInvoices = [];
      for (const inv of uploadedInvoices) {
        createdInvoices.push(
          await base44.entities.Document.create({
            draw_vendor_id: dv.id,
            document_type: inv.doc_type || "invoice",
            status: "complete",
            file_url: inv.file_url,
            amount: inv.amount ? Number(inv.amount) : null,
            invoice_number: inv.invoice_number || null,
            received_date: today,
          })
        );
      }
      let placeholderInvoice = null;
      if (uploadedInvoices.length === 0) {
        placeholderInvoice = await base44.entities.Document.create({ draw_vendor_id: dv.id, document_type: "invoice", status: "missing" });
      }
      const invoicesForConditionals = placeholderInvoice ? [placeholderInvoice] : createdInvoices;
      await base44.entities.Document.bulkCreate(
        invoicesForConditionals.map((inv) => ({
          draw_vendor_id: dv.id,
          document_type: "conditional_lien_release",
          status: "missing",
          related_invoice_document_id: inv.id,
        }))
      );
      await base44.entities.Document.create({ draw_vendor_id: dv.id, document_type: "unconditional_lien_release", status: "missing" });
      queryClient.invalidateQueries({ queryKey: ["drawVendors", drawId] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add Vendor to Draw</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Invoices</Label>
            {invoices.map((inv, index) => (
              <InvoiceItem
                key={index}
                invoice={inv}
                onChange={(updated) => handleInvoiceChange(index, updated)}
                onRemove={() => handleInvoiceRemove(index)}
                onExtracted={index === 0 ? handleFirstInvoiceExtracted : undefined}
              />
            ))}
            <Button type="button" variant="outline" size="sm" onClick={handleAddInvoice}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />Add Invoice
            </Button>
          </div>

          {invoices.length > 0 && (
            <div className="flex items-center justify-between text-sm bg-slate-50 rounded-md px-3 py-2">
              <span className="text-slate-600">Total Amount</span>
              <span className="font-semibold text-slate-900">{formatCurrency(totalAmount)}</span>
            </div>
          )}

          {extracted && (
            <p className="text-xs text-blue-600 bg-blue-50 rounded-md px-3 py-2">
              Fields below were auto-filled from the invoice — please review.
            </p>
          )}
          <div className="space-y-1.5">
            <Label>Vendor</Label>
            {showNewVendor ? (
              <div className="flex gap-2">
                <Input
                  value={newVendorName}
                  onChange={(e) => setNewVendorName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateVendor(); } }}
                  placeholder="New vendor name"
                  autoFocus
                />
                <Button type="button" size="sm" onClick={handleCreateVendor} disabled={creatingVendor || !newVendorName.trim()}>
                  {creatingVendor ? "..." : "Add"}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setShowNewVendor(false); setNewVendorName(""); }}>Cancel</Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Select value={form.vendor_id} onValueChange={(v) => {
                  if (v === "__new__") { setShowNewVendor(true); setForm((f) => ({ ...f, vendor_id: "" })); }
                  else setForm({ ...form, vendor_id: v });
                }}>
                  <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__new__" className="font-medium text-primary">+ Add New Vendor</SelectItem>
                    {availableVendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {availableVendors.length === 0 && !showNewVendor && (
              <p className="text-xs text-amber-600">No available vendors — add a new one above.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Scope of Work</Label>
            <Input value={form.scope_of_work} onChange={(e) => setForm({ ...form, scope_of_work: e.target.value })} placeholder="e.g., Foundation pour" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !form.vendor_id}>{saving ? "Adding..." : "Add Vendor"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}