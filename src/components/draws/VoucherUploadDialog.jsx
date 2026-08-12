import React, { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Loader2 } from "lucide-react";

const VOUCHER_STATUSES = ["draft", "pending", "approved", "paid", "void"];

export default function VoucherUploadDialog({ open, onOpenChange, drawId }) {
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [step, setStep] = useState("select");
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    voucher_number: "", draw_vendor_id: "", amount: "", status: "draft",
    issue_date: "", payment_date: "", notes: "",
  });

  const { data: drawVendors = [] } = useQuery({
    queryKey: ["drawVendors", drawId],
    queryFn: () => base44.entities.DrawVendor.filter({ draw_cycle_id: drawId }),
  });
  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => base44.entities.Vendor.list(),
  });
  const vendorMap = new Map(vendors.map((v) => [v.id, v]));

  const reset = () => {
    setStep("select");
    setFile(null);
    setFileUrl("");
    setExtracting(false);
    setSaving(false);
    setError("");
    setForm({ voucher_number: "", draw_vendor_id: "", amount: "", status: "draft", issue_date: "", payment_date: "", notes: "" });
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleOpenChange = (v) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError("");
    setFile(f);
    setExtracting(true);
    try {
      const up = await base44.integrations.Core.UploadFile({ file: f });
      const url = up.file_url;
      setFileUrl(url);
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: "Extract voucher details from this voucher PDF. Return: voucher_number, total amount as a number, payee/vendor name, issue_date in ISO yyyy-mm-dd, payment_date in ISO yyyy-mm-dd if present, and a short notes summary. Use null for any field not present in the document.",
        file_urls: [url],
        response_json_schema: {
          type: "object",
          properties: {
            voucher_number: { type: ["string", "null"] },
            amount: { type: ["number", "null"] },
            vendor_name: { type: ["string", "null"] },
            issue_date: { type: ["string", "null"] },
            payment_date: { type: ["string", "null"] },
            notes: { type: ["string", "null"] },
          },
        },
      });
      let matchedDvId = "";
      const vname = (res?.vendor_name || "").toLowerCase().trim();
      if (vname) {
        const match = drawVendors.find((dv) => {
          const vn = vendorMap.get(dv.vendor_id)?.name?.toLowerCase() || "";
          return vn && (vn.includes(vname) || vname.includes(vn));
        });
        if (match) matchedDvId = match.id;
      }
      setForm({
        voucher_number: res?.voucher_number || "",
        draw_vendor_id: matchedDvId,
        amount: res?.amount != null ? String(res.amount) : "",
        status: "draft",
        issue_date: res?.issue_date || "",
        payment_date: res?.payment_date || "",
        notes: res?.notes || "",
      });
      setStep("review");
    } catch (err) {
      setError(err.message || "Failed to extract voucher data");
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const dv = drawVendors.find((d) => d.id === form.draw_vendor_id);
    try {
      await base44.entities.Voucher.create({
        voucher_number: form.voucher_number,
        draw_cycle_id: drawId,
        draw_vendor_id: form.draw_vendor_id || null,
        vendor_id: dv?.vendor_id || null,
        amount: form.amount ? Number(form.amount) : null,
        status: form.status,
        issue_date: form.issue_date || null,
        payment_date: form.payment_date || null,
        notes: form.notes,
        file_url: fileUrl || null,
      });
      queryClient.invalidateQueries({ queryKey: ["vouchers", drawId] });
      handleOpenChange(false);
    } catch (err) {
      setError(err.message || "Failed to save voucher");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Voucher PDF</DialogTitle>
          <DialogDescription>Upload a voucher PDF and we'll extract the details for you to review.</DialogDescription>
        </DialogHeader>
        {step === "select" ? (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-slate-50"
              onClick={() => fileRef.current?.click()}
            >
              {extracting ? (
                <div className="flex flex-col items-center gap-2 text-slate-500">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span className="text-sm">Uploading & extracting details...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-500">
                  <Upload className="w-8 h-8" />
                  <span className="text-sm font-medium">Click to select a voucher PDF</span>
                  {file?.name && <span className="text-xs text-slate-400">{file.name}</span>}
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleFile} />
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs text-slate-500">Review the extracted details and adjust as needed.</p>
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
            {error && <p className="text-sm text-red-600">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Voucher"}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}