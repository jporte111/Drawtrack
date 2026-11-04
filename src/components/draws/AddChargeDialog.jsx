import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { EXTRACTION_SCHEMA } from "./InvoiceItem";
import { categorizeExpense, createCharge } from "@/lib/charges";
import { formatCurrency } from "@/lib/format";

const UNCATEGORIZED = "__none__";

export default function AddChargeDialog({ open, onOpenChange, drawId, clientId, categories = [] }) {
  const queryClient = useQueryClient();
  const inputRef = useRef(null);
  const [mode, setMode] = useState("upload");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [extracted, setExtracted] = useState(false);
  const [form, setForm] = useState({
    vendor_id: "",
    vendor_name: "",
    budget_category_id: "",
    description: "",
    amount: "",
    invoice_number: "",
    invoice_date: "",
    needs_review: false,
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => base44.entities.Vendor.list(),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setMode("upload");
    setFile(null);
    setExtracted(false);
    setForm({
      vendor_id: "",
      vendor_name: "",
      budget_category_id: "",
      description: "",
      amount: "",
      invoice_number: "",
      invoice_date: "",
      needs_review: false,
    });
  }, [open]);

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const similarVendors = useMemo(() => {
    const typed = form.vendor_name.trim().toLowerCase();
    if (!typed || form.vendor_id) return [];
    return vendors
      .filter((v) => {
        const name = String(v.name || "").toLowerCase();
        return name && (name.includes(typed) || typed.includes(name));
      })
      .slice(0, 3);
  }, [form.vendor_name, form.vendor_id, vendors]);

  const handleFile = async (e) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: picked });
      setFile({ url: file_url, name: picked.name });

      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: EXTRACTION_SCHEMA,
      });
      const data = result?.status === "success" ? result.output || {} : {};
      setExtracted(true);

      const next = {
        amount: data.amount != null ? String(data.amount) : form.amount,
        invoice_number: data.invoice_number || form.invoice_number,
        description: data.scope_of_work || form.description,
        vendor_name: data.vendor_name || form.vendor_name,
      };
      const exact = vendors.find(
        (v) => String(v.name || "").trim().toLowerCase() === String(next.vendor_name || "").toLowerCase(),
      );
      if (exact) next.vendor_id = exact.id;

      const suggestion = await categorizeExpense({
        categories,
        fileUrl: file_url,
        description: next.description,
      });
      next.budget_category_id = suggestion.categoryId || "";
      next.needs_review = !suggestion.categoryId;
      set(next);
    } finally {
      setUploading(false);
    }
  };

  const suggestFromDescription = async () => {
    setUploading(true);
    try {
      const suggestion = await categorizeExpense({ categories, description: form.description });
      set({
        budget_category_id: suggestion.categoryId || "",
        needs_review: !suggestion.categoryId,
      });
    } finally {
      setUploading(false);
    }
  };

  const amountValue = Number(form.amount) || 0;
  const canSave = amountValue > 0 && (mode === "manual" || !!file?.url) && !uploading && !saving;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      await createCharge({
        drawId,
        clientId,
        vendorId: form.vendor_id,
        vendorName: form.vendor_name,
        budgetCategoryId: form.budget_category_id,
        description: form.description,
        amount: amountValue,
        fileUrl: file?.url || "",
        invoiceNumber: form.invoice_number,
        invoiceDate: form.invoice_date,
        reviewNeeded: form.needs_review || !form.budget_category_id,
      });
      queryClient.invalidateQueries({ queryKey: ["drawVendors", drawId] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["clientVendors", clientId] });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add Invoice / Expense</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs value={mode} onValueChange={setMode}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="upload">Upload invoice</TabsTrigger>
              <TabsTrigger value="manual">Enter manually</TabsTrigger>
            </TabsList>
          </Tabs>

          {mode === "upload" && (
            <div className="space-y-2">
              <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={handleFile} />
              {file?.url ? (
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-md px-3 py-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span className="truncate flex-1">{file.name}</span>
                  <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => inputRef.current?.click()}>
                    Replace
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  {uploading ? "Reading invoice..." : "Upload invoice file"}
                </Button>
              )}
              {extracted && (
                <p className="text-xs text-blue-600 bg-blue-50 rounded-md px-3 py-2">
                  Fields were read from the invoice — please review before saving.
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Vendor (optional)</Label>
              <Select
                value={form.vendor_id || "__none__"}
                onValueChange={(v) =>
                  set(v === "__none__" ? { vendor_id: "" } : { vendor_id: v, vendor_name: "" })
                }
              >
                <SelectTrigger><SelectValue placeholder="No vendor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No vendor / not billed to a vendor</SelectItem>
                  {vendors
                    .slice()
                    .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                    .map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Input
                value={form.vendor_name}
                onChange={(e) => set({ vendor_name: e.target.value })}
                placeholder="Or type a vendor name (matched to the master vendor list)"
                disabled={!!form.vendor_id}
                className="mt-1"
              />
              {similarVendors.length > 0 && (
                <div className="text-xs text-amber-700 bg-amber-50 rounded-md px-2.5 py-1.5 space-y-1">
                  <div className="flex items-center gap-1 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5" /> Similar vendor already exists — check before creating a new one:
                  </div>
                  {similarVendors.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className="block text-left text-blue-700 hover:underline"
                      onClick={() => set({ vendor_id: v.id, vendor_name: "" })}
                    >
                      Use “{v.name}”
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Budget category</Label>
              <Select
                value={form.budget_category_id || UNCATEGORIZED}
                onValueChange={(v) => set({ budget_category_id: v === UNCATEGORIZED ? "" : v, needs_review: v === UNCATEGORIZED })}
              >
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNCATEGORIZED}>Not sure — flag for review</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => set({ amount: e.target.value })}
                placeholder="0.00"
                className="text-right tabular-nums"
                required
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label>Description</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={suggestFromDescription}
                  disabled={uploading || !categories.length}
                >
                  Auto-categorize
                </Button>
              </div>
              <Input
                value={form.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="Scope of work or expense description"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Invoice #</Label>
              <Input
                value={form.invoice_number}
                onChange={(e) => set({ invoice_number: e.target.value })}
                placeholder="Optional"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Invoice date</Label>
              <Input
                type="date"
                value={form.invoice_date}
                onChange={(e) => set({ invoice_date: e.target.value })}
              />
            </div>
          </div>

          {!form.budget_category_id && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-md px-3 py-2">
              This expense will be flagged for manual category review.
            </p>
          )}
          {mode === "manual" && !file?.url && (
            <p className="text-xs text-slate-500">
              Saved without a supporting invoice — it will show as “Missing Invoice” until you attach one.
            </p>
          )}

          <DialogFooter>
            <div className="flex items-center justify-between w-full gap-3">
              <span className="text-sm text-slate-500">
                {amountValue > 0 ? formatCurrency(amountValue) : ""}
              </span>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit" disabled={!canSave}>
                  {saving ? "Saving..." : "Add"}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}