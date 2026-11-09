import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle } from "lucide-react";
import { EXTRACTION_SCHEMA } from "./InvoiceItem";
import InvoiceDropZone from "./InvoiceDropZone";
import ChargeFileRow from "./ChargeFileRow";
import { categorizeExpense, createCharge } from "@/lib/charges";
import { formatCurrency } from "@/lib/format";

const UNCATEGORIZED = "__none__";
const norm = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
const newKey = () => `f-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const emptyForm = {
  vendor_id: "",
  vendor_name: "",
  budget_category_id: "",
  description: "",
  amount: "",
  invoice_number: "",
  invoice_date: "",
  needs_review: false,
};

export default function AddChargeDialog({ open, onOpenChange, drawId, clientId, categories = [] }) {
  const queryClient = useQueryClient();
  const categorizedRef = useRef(false);
  const [mode, setMode] = useState("manual");
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => base44.entities.Vendor.list(),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setMode("manual");
    setRows([]);
    setForm(emptyForm);
    categorizedRef.current = false;
  }, [open]);

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const vendorOptions = useMemo(
    () =>
      vendors
        .map((v) => ({ id: v.id, name: v.name }))
        .sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [vendors],
  );

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

  const updateRow = (key, patch) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key) => setRows((prev) => prev.filter((r) => r.key !== key));

  const matchVendor = (rawName) => {
    const n = norm(rawName);
    if (!n) return { vendor_id: "", vendor_name: "", needsReview: true };
    const exact = vendors.find((v) => norm(v.name) === n);
    if (exact) return { vendor_id: exact.id, vendor_name: exact.name, needsReview: false };
    return { vendor_id: "", vendor_name: String(rawName).trim(), needsReview: true };
  };

  const processOne = async (file, key) => {
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: EXTRACTION_SCHEMA,
      });
      const data = result?.status === "success" ? result.output || {} : {};
      updateRow(key, {
        file_url,
        filename: file.name,
        uploading: false,
        amount: data.amount != null ? String(data.amount) : "",
        invoice_number: data.invoice_number || "",
        ...matchVendor(data.vendor_name),
      });

      if (!categorizedRef.current && categories.length) {
        categorizedRef.current = true;
        const suggestion = await categorizeExpense({
          categories,
          fileUrl: file_url,
          description: data.scope_of_work,
        });
        if (suggestion.categoryId) set({ budget_category_id: suggestion.categoryId, needs_review: false });
      }
    } catch (err) {
      updateRow(key, { uploading: false, error: err.message || "Could not read this file." });
    }
  };

  const handleFiles = (files) => {
    const fresh = files.map((f) => ({
      key: newKey(),
      filename: f.name,
      file_url: "",
      uploading: true,
      error: "",
      amount: "",
      invoice_number: "",
      vendor_id: "",
      vendor_name: "",
      needsReview: true,
    }));
    setRows((prev) => [...prev, ...fresh]);
    files.forEach((file, i) => processOne(file, fresh[i].key));
  };

  const suggestFromDescription = async () => {
    setSaving(false);
    const suggestion = await categorizeExpense({ categories, description: form.description });
    set({ budget_category_id: suggestion.categoryId || "", needs_review: !suggestion.categoryId });
  };

  const amountValue = Number(form.amount) || 0;
  const readyRows = rows.filter((r) => r.file_url);
  const uploadBusy = rows.some((r) => r.uploading);
  const canSave =
    mode === "manual"
      ? amountValue > 0 && !saving
      : readyRows.length > 0 &&
        !uploadBusy &&
        !saving &&
        readyRows.every((r) => Number(r.amount) > 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      if (mode === "manual") {
        await createCharge({
          drawId,
          clientId,
          vendorId: form.vendor_id,
          vendorName: form.vendor_name,
          budgetCategoryId: form.budget_category_id,
          description: form.description,
          amount: amountValue,
          fileUrl: "",
          invoiceNumber: form.invoice_number,
          invoiceDate: form.invoice_date,
          reviewNeeded: form.needs_review || !form.budget_category_id,
        });
      } else {
        for (const row of readyRows) {
          await createCharge({
            drawId,
            clientId,
            vendorId: row.vendor_id,
            vendorName: row.vendor_name,
            budgetCategoryId: form.budget_category_id,
            description: form.description,
            amount: Number(row.amount),
            fileUrl: row.file_url,
            invoiceNumber: row.invoice_number,
            invoiceDate: form.invoice_date,
            reviewNeeded: form.needs_review || !form.budget_category_id,
          });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["drawVendors", drawId] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["clientVendors", clientId] });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const total = mode === "manual" ? amountValue : readyRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add Invoice / Expense</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs value={mode} onValueChange={setMode}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="manual">Enter manually</TabsTrigger>
              <TabsTrigger value="upload">Upload invoices</TabsTrigger>
            </TabsList>
          </Tabs>

          {mode === "manual" && (
            <p className="text-xs text-slate-500">
              No invoice file needed — pick the vendor, enter the amount, and this line is added to the draw.
            </p>
          )}

          {mode === "upload" && (
            <div className="space-y-2">
              <InvoiceDropZone onFiles={handleFiles} busy={uploadBusy} />
              <p className="text-xs text-slate-500">
                Drop one or several invoices. Each file becomes its own line on the draw, matched to its vendor.
              </p>
              {rows.length > 0 && (
                <div className="space-y-1.5">
                  {rows.map((row) => (
                    <ChargeFileRow
                      key={row.key}
                      item={row}
                      vendorOptions={vendorOptions}
                      onChange={(updated) => updateRow(row.key, updated)}
                      onRemove={() => removeRow(row.key)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {mode === "manual" && (
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
                    {vendorOptions.map((v) => (
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
            )}

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

            {mode === "manual" ? (
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
            ) : (
              <div className="space-y-1.5">
                <Label>Invoice date</Label>
                <Input type="date" value={form.invoice_date} onChange={(e) => set({ invoice_date: e.target.value })} />
              </div>
            )}

            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label>Description</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={suggestFromDescription}
                  disabled={uploadBusy || !categories.length}
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

            {mode === "manual" && (
              <>
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
                  <Input type="date" value={form.invoice_date} onChange={(e) => set({ invoice_date: e.target.value })} />
                </div>
              </>
            )}
          </div>

          {!form.budget_category_id && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-md px-3 py-2">
              This expense will be flagged for manual category review.
            </p>
          )}
          {mode === "manual" && (
            <p className="text-xs text-slate-500">
              Saved without a supporting invoice — it will show as “Missing Invoice” until you attach one.
            </p>
          )}

          <DialogFooter>
            <div className="flex items-center justify-between w-full gap-3">
              <span className="text-sm text-slate-500">
                {total > 0 ? formatCurrency(total) : ""}
              </span>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit" disabled={!canSave}>
                  {saving ? "Saving..." : mode === "upload" && readyRows.length > 1 ? `Add ${readyRows.length} Invoices` : "Add"}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}