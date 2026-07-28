import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import InvoiceItem from "./InvoiceItem";

export default function AddInvoiceDialog({ open, onOpenChange, drawVendorId, drawId }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    if (open) {
      setInvoices([]);
    }
  }, [open]);

  const totalAmount = invoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);

  const handleAddInvoice = () => {
    setInvoices((prev) => [...prev, { file_url: "", filename: "", amount: "", uploading: false, error: "" }]);
  };

  const handleInvoiceChange = (index, updated) => {
    setInvoices((prev) => prev.map((inv, i) => (i === index ? updated : inv)));
  };

  const handleInvoiceRemove = (index) => {
    setInvoices((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const docsToCreate = invoices
        .filter((inv) => inv.file_url)
        .map((inv) => ({
          draw_vendor_id: drawVendorId,
          document_type: "invoice",
          status: "complete",
          file_url: inv.file_url,
          amount: inv.amount ? Number(inv.amount) : null,
          received_date: new Date().toISOString().split("T")[0],
        }));
      if (docsToCreate.length > 0) {
        await base44.entities.Document.bulkCreate(docsToCreate);
      }
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add Invoices</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Invoices</Label>
            {invoices.map((inv, index) => (
              <InvoiceItem
                key={index}
                invoice={inv}
                onChange={(updated) => handleInvoiceChange(index, updated)}
                onRemove={() => handleInvoiceRemove(index)}
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || invoices.filter((i) => i.file_url).length === 0}>
              {saving ? "Adding..." : "Add Invoices"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}