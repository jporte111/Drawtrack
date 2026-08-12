import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const VOUCHER_STATUSES = ["draft", "pending", "approved", "paid", "void"];

export default function VoucherFormDialog({ open, onOpenChange, drawId, voucher }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ voucher_number: "", draw_vendor_id: "", amount: "", status: "draft", issue_date: "", payment_date: "", notes: "" });

  const { data: drawVendors = [] } = useQuery({
    queryKey: ["drawVendors", drawId],
    queryFn: () => base44.entities.DrawVendor.filter({ draw_cycle_id: drawId }),
  });
  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => base44.entities.Vendor.list(),
  });

  const vendorMap = new Map(vendors.map((v) => [v.id, v]));

  useEffect(() => {
    if (!open) return;
    if (voucher) {
      setForm({
        voucher_number: voucher.voucher_number || "",
        draw_vendor_id: voucher.draw_vendor_id || "",
        amount: voucher.amount != null ? String(voucher.amount) : "",
        status: voucher.status || "draft",
        issue_date: voucher.issue_date || "",
        payment_date: voucher.payment_date || "",
        notes: voucher.notes || "",
      });
    } else {
      setForm({ voucher_number: "", draw_vendor_id: "", amount: "", status: "draft", issue_date: "", payment_date: "", notes: "" });
    }
  }, [open, voucher]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const dv = drawVendors.find((d) => d.id === form.draw_vendor_id);
    try {
      const payload = {
        voucher_number: form.voucher_number,
        draw_vendor_id: form.draw_vendor_id || null,
        vendor_id: dv?.vendor_id || null,
        amount: form.amount ? Number(form.amount) : null,
        status: form.status,
        issue_date: form.issue_date || null,
        payment_date: form.payment_date || null,
        notes: form.notes,
      };
      if (voucher) {
        await base44.entities.Voucher.update(voucher.id, payload);
      } else {
        await base44.entities.Voucher.create({ ...payload, draw_cycle_id: drawId });
      }
      queryClient.invalidateQueries({ queryKey: ["vouchers", drawId] });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{voucher ? "Edit Voucher" : "New Voucher"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Voucher #</Label>
              <Input value={form.voucher_number} onChange={(e) => setForm({ ...form, voucher_number: e.target.value })} placeholder="V-001" />
            </div>
            <div className="space-y-1.5">
              <Label>Amount ($)</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Vendor</Label>
              <Select value={form.draw_vendor_id} onValueChange={(v) => setForm({ ...form, draw_vendor_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>
                  {drawVendors.map((dv) => (
                    <SelectItem key={dv.id} value={dv.id}>{vendorMap.get(dv.vendor_id)?.name || "Unknown"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VOUCHER_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Issue Date</Label>
              <Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Date</Label>
              <Input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : voucher ? "Update" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}