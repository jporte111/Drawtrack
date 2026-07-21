import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import InvoiceUpload from "./InvoiceUpload";

export default function AddVendorDialog({ open, onOpenChange, drawId, clientId }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ vendor_id: "", scope_of_work: "", amount: "", notes: "" });
  const [invoiceFileUrl, setInvoiceFileUrl] = useState("");
  const [extracted, setExtracted] = useState(false);

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => base44.entities.Vendor.list(),
  });
  const { data: drawVendors = [] } = useQuery({
    queryKey: ["drawVendors", drawId],
    queryFn: () => base44.entities.DrawVendor.filter({ draw_cycle_id: drawId }),
  });

  const linkedIds = new Set(drawVendors.map((dv) => dv.vendor_id));
  const availableVendors = vendors.filter((v) => !linkedIds.has(v.id) && v.client_id === clientId);

  useEffect(() => {
    if (open) {
      setForm({ vendor_id: "", scope_of_work: "", amount: "", notes: "" });
      setInvoiceFileUrl("");
      setExtracted(false);
    }
  }, [open]);

  const handleExtracted = async (data) => {
    setForm((f) => ({
      ...f,
      scope_of_work: data.scope_of_work || f.scope_of_work,
      amount: data.amount != null ? String(data.amount) : f.amount,
    }));
    setInvoiceFileUrl(data.invoice_file_url || "");
    setExtracted(true);

    if (data.vendor_name) {
      const lower = data.vendor_name.toLowerCase();
      const existing = vendors.find(
        (v) => v.name.toLowerCase().includes(lower) || lower.includes(v.name.toLowerCase())
      );
      if (existing) {
        setForm((f) => ({ ...f, vendor_id: existing.id }));
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
        amount: form.amount ? Number(form.amount) : null,
        notes: form.notes,
        status: "pending",
      });
      const invoiceDoc = invoiceFileUrl
        ? { draw_vendor_id: dv.id, document_type: "invoice", status: "complete", file_url: invoiceFileUrl, amount: form.amount ? Number(form.amount) : null, received_date: new Date().toISOString().split("T")[0] }
        : { draw_vendor_id: dv.id, document_type: "invoice", status: "missing" };
      await base44.entities.Document.bulkCreate([
        invoiceDoc,
        { draw_vendor_id: dv.id, document_type: "conditional_lien_release", status: "missing" },
        { draw_vendor_id: dv.id, document_type: "unconditional_lien_release", status: "missing" },
      ]);
      queryClient.invalidateQueries({ queryKey: ["drawVendors", drawId] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Vendor to Draw</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <InvoiceUpload onExtracted={handleExtracted} />
          {extracted && (
            <p className="text-xs text-blue-600 bg-blue-50 rounded-md px-3 py-2">
              Fields below were auto-filled from the invoice — please review.
            </p>
          )}
          <div className="space-y-1.5">
            <Label>Vendor</Label>
            <Select value={form.vendor_id} onValueChange={(v) => setForm({ ...form, vendor_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
              <SelectContent>
                {availableVendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {availableVendors.length === 0 && (
              <p className="text-xs text-amber-600">All vendors are already linked to this draw.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Scope of Work</Label>
            <Input value={form.scope_of_work} onChange={(e) => setForm({ ...form, scope_of_work: e.target.value })} placeholder="e.g., Foundation pour" />
          </div>
          <div className="space-y-1.5">
            <Label>Amount ($)</Label>
            <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
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