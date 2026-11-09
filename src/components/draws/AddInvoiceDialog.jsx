import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { EXTRACTION_SCHEMA } from "./InvoiceItem";
import InvoiceDropZone from "./InvoiceDropZone";
import InvoiceDropRow from "./InvoiceDropRow";
import { retentionPatch } from "@/lib/retention";
import { resolveMasterVendor } from "@/lib/charges";
import { useToast } from "@/components/ui/use-toast";

const norm = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
const newKey = () => `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const blankItem = (over = {}) => ({
  key: newKey(),
  filename: "",
  file_url: "",
  uploading: false,
  error: "",
  amount: "",
  invoice_number: "",
  doc_type: "invoice",
  vendor_id: null,
  vendor_name: "",
  needsReview: true,
  ...over,
});

export default function AddInvoiceDialog({ open, onOpenChange, drawVendorId, drawId, retentionRate }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState([]);

  const { data: drawVendors = [] } = useQuery({
    queryKey: ["drawVendors", drawId],
    queryFn: () => base44.entities.DrawVendor.filter({ draw_cycle_id: drawId }),
    enabled: !!drawId && open,
  });
  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => base44.entities.Vendor.list(),
    enabled: open,
  });
  const { data: drawCycle } = useQuery({
    queryKey: ["drawCycle", drawId],
    queryFn: () => base44.entities.DrawCycle.get(drawId),
    enabled: !!drawId && open,
  });
  const { data: clientVendors = [] } = useQuery({
    queryKey: ["clientVendors", drawCycle?.client_id],
    queryFn: () => base44.entities.ClientVendor.filter({ client_id: drawCycle.client_id }),
    enabled: !!drawCycle?.client_id && open,
  });

  const vendorOptions = useMemo(() => {
    const clientIds = new Set(clientVendors.map((cv) => cv.vendor_id));
    const map = new Map();
    vendors
      .filter((v) => clientIds.has(v.id))
      .forEach((v) => map.set(v.id, { id: v.id, name: v.name }));
    drawVendors.forEach((dv) => {
      const master = vendors.find((v) => v.id === dv.vendor_id);
      if (master) map.set(master.id, { id: master.id, name: master.name });
      else if (dv.vendor_name) map.set(`name:${norm(dv.vendor_name)}`, { id: null, name: dv.vendor_name });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [vendors, clientVendors, drawVendors]);

  // When opened from a vendor row, that vendor is the default for rows the file does not identify.
  const defaultVendor = useMemo(() => {
    if (!drawVendorId) return null;
    const dv = drawVendors.find((v) => v.id === drawVendorId);
    if (!dv) return null;
    const name = vendors.find((v) => v.id === dv.vendor_id)?.name || dv.vendor_name || "";
    if (!name) return null;
    return { vendor_id: dv.vendor_id || null, vendor_name: name, needsReview: false };
  }, [drawVendorId, drawVendors, vendors]);

  useEffect(() => {
    if (open) setItems([]);
  }, [open]);

  const matchVendor = (rawName) => {
    const n = norm(rawName);
    if (!n) {
      if (defaultVendor) return { ...defaultVendor };
      return { vendor_id: null, vendor_name: "", needsReview: true };
    }
    const exact = vendorOptions.find((o) => norm(o.name) === n);
    if (exact) return { vendor_id: exact.id, vendor_name: exact.name, needsReview: false };
    const partial = vendorOptions.find((o) => {
      const on = norm(o.name);
      return on.length > 2 && (on.includes(n) || n.includes(on));
    });
    if (partial) return { vendor_id: partial.id, vendor_name: partial.name, needsReview: true };
    return { vendor_id: null, vendor_name: String(rawName).trim(), needsReview: true };
  };

  const update = (key, patch) => setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const remove = (key) => setItems((prev) => prev.filter((i) => i.key !== key));

  const processOne = async (file, key) => {
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: EXTRACTION_SCHEMA,
      });
      const out = result?.status === "success" ? result.output || {} : {};
      update(key, {
        file_url,
        filename: file.name,
        uploading: false,
        amount: out.amount != null ? String(out.amount) : "",
        invoice_number: out.invoice_number || "",
        ...matchVendor(out.vendor_name),
      });
    } catch (err) {
      update(key, { uploading: false, error: err.message || "Could not read this file." });
    }
  };

  const handleFiles = (files) => {
    const rows = files.map((f) =>
      blankItem({
        filename: f.name,
        uploading: true,
        ...(defaultVendor ? { ...defaultVendor, needsReview: false } : { vendor_name: "" }),
      }),
    );
    setItems((prev) => [...prev, ...rows]);
    files.forEach((file, i) => processOne(file, rows[i].key));
  };

  const addBlank = () => {
    setItems((prev) => [
      ...prev,
      blankItem(defaultVendor ? { ...defaultVendor, needsReview: false } : { vendor_name: "" }),
    ]);
  };

  const groups = useMemo(() => {
    const map = new Map();
    items.forEach((item) => {
      const name = (item.vendor_name || "").trim();
      const key = item.vendor_id ? `id:${item.vendor_id}` : name ? `name:${norm(name)}` : "unassigned";
      if (!map.has(key)) map.set(key, { key, name: name || "Unassigned", needsReview: false, items: [] });
      const group = map.get(key);
      if (item.needsReview) group.needsReview = true;
      group.items.push(item);
    });
    return Array.from(map.values())
      .map((g) => ({ ...g, total: g.items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const rows = items.filter((i) => i.file_url || i.amount);
  const total = rows.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const uploading = items.some((i) => i.uploading);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rows.length === 0) return;
    if (rows.some((r) => !(r.vendor_name || "").trim())) {
      toast({
        variant: "destructive",
        title: "Vendor needed",
        description: "Every invoice needs a vendor before it can be saved.",
      });
      return;
    }
    setSaving(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const byVendor = new Map();
      rows.forEach((r) => {
        const key = r.vendor_id ? `id:${r.vendor_id}` : `name:${norm(r.vendor_name)}`;
        if (!byVendor.has(key)) byVendor.set(key, []);
        byVendor.get(key).push(r);
      });

      for (const groupRows of byVendor.values()) {
        const first = groupRows[0];
        let vendorId = first.vendor_id || null;
        let vendorName = first.vendor_name.trim();

        let drawVendor = drawVendors.find((dv) =>
          vendorId ? dv.vendor_id === vendorId : norm(dv.vendor_name) === norm(vendorName),
        );

        if (!drawVendor) {
          if (!vendorId) {
            const vendor = await resolveMasterVendor({ vendorName, clientId: drawCycle?.client_id });
            vendorId = vendor?.id || null;
            vendorName = vendor?.name || vendorName;
          }
          drawVendor = await base44.entities.DrawVendor.create({
            draw_cycle_id: drawId,
            vendor_id: vendorId,
            vendor_name: vendorName,
            status: "pending",
          });
        }

        for (const row of groupRows) {
          const amount = row.amount ? Number(row.amount) : null;
          const doc = await base44.entities.Document.create({
            draw_vendor_id: drawVendor.id,
            document_type: row.doc_type || "invoice",
            status: "complete",
            file_url: row.file_url || null,
            amount,
            invoice_number: row.invoice_number || "",
            received_date: row.file_url ? today : "",
            ...(retentionRate != null ? retentionPatch(amount, retentionRate) : {}),
          });
          await base44.entities.Document.create({
            draw_vendor_id: drawVendor.id,
            document_type: "conditional_lien_release",
            status: "missing",
            related_invoice_document_id: doc.id,
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["drawVendors", drawId] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["clientVendors"] });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Invoices</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <InvoiceDropZone onFiles={handleFiles} busy={uploading} />

          {groups.length === 0 ? (
            <p className="text-xs text-slate-500">
              Drop invoice files above, or add a blank line to type one in without a file.
            </p>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => (
                <div key={group.key} className="overflow-hidden rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between gap-2 bg-slate-100 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-800">{group.name}</span>
                      {group.needsReview && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600">
                          <AlertTriangle className="w-3 h-3" /> Review vendor
                        </span>
                      )}
                      <span className="shrink-0 text-xs text-slate-500">
                        {group.items.length} invoice{group.items.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-slate-900">
                      {formatCurrency(group.total)}
                    </span>
                  </div>
                  <div className="space-y-2 p-2">
                    {group.items.map((item) => (
                      <InvoiceDropRow
                        key={item.key}
                        invoice={item}
                        vendorOptions={vendorOptions}
                        onChange={(updated) => update(item.key, updated)}
                        onRemove={() => remove(item.key)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="outline" size="sm" onClick={addBlank}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add blank invoice
            </Button>
            <div className="text-sm text-slate-600">
              Total <span className="font-semibold tabular-nums text-slate-900">{formatCurrency(total)}</span>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || uploading || rows.length === 0}>
              {saving ? "Adding..." : `Add ${rows.length || ""} Invoice${rows.length === 1 ? "" : "s"}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}