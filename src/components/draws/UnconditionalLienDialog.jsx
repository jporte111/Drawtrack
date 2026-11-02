import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, FileText, Upload } from "lucide-react";
import LienFormFields from "./LienFormFields";
import useLienContext from "@/hooks/useLienContext";
import { useToast } from "@/components/ui/use-toast";

export default function UnconditionalLienDialog({ open, onOpenChange, clientVendorId, drawVendorId, vendorName, projectName, drawAmount }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(null); // 'generate' | 'upload'
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const { client, drawCycle } = useLienContext({ drawVendorId, clientVendorId });
  const [fields, setFields] = useState({});

  useEffect(() => {
    if (!open) return;
    setFields({
      customer: client?.name || "",
      owner: client?.name || "",
      location: client?.address || drawCycle?.project_name || projectName || "",
      throughDate: drawCycle?.draw_date || "",
      amount: drawAmount ?? "",
    });
  }, [open, client?.id, drawCycle?.id]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["documents"] });
  };

  const emailRelease = async (docId) => {
    if (!docId) return;
    try {
      const res = await base44.functions.invoke("sendReleaseEmail", { document_id: docId, mode: "send" });
      const data = res.data || {};
      queryClient.invalidateQueries({ queryKey: ["releaseEmailLogs"] });
      if (data.ok) {
        toast({ title: "Release emailed", description: `Sent to ${(data.recipients || []).length} release contact(s).` });
      } else if (data.reason === "no_release_contacts") {
        toast({ title: "Release saved", description: "No active release contacts for this client." });
      } else if (data.reason === "send_failed") {
        toast({ variant: "destructive", title: "Release email failed", description: data.error || "See the Release emails log." });
      }
    } catch (e) {
      // Email problems must never block saving the release
    }
  };

  const handleGenerate = async () => {
    setBusy("generate");
    setError(null);
    try {
      const res = await base44.functions.invoke("generateLienReleaseForm", {
        form_type: "unconditional",
        vendor_name: vendorName,
        project_name: projectName,
        draw_amount: drawAmount,
        fields: {
          claimant: vendorName,
          customer: fields.customer,
          owner: fields.owner,
          location: fields.location,
          through_date: fields.throughDate,
          amount: fields.amount === "" ? null : Number(fields.amount),
        },
      });
      const data = res.data;
      const byteChars = atob(data.pdf_base64);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      const file = new File([bytes], data.filename, { type: "application/pdf" });
      const up = await base44.integrations.Core.UploadFile({ file });
      const created = await base44.entities.Document.create({
        client_vendor_id: clientVendorId,
        document_type: "unconditional_lien_release",
        status: "complete",
        file_url: up.file_url,
        source: "manual",
      });
      refresh();
      onOpenChange(false);
      emailRelease(created.id);
    } catch (e) {
      setError(e.message || "Failed to generate form");
    } finally {
      setBusy(null);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy("upload");
    setError(null);
    try {
      const up = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Document.create({
        client_vendor_id: clientVendorId,
        document_type: "unconditional_lien_release",
        status: "complete",
        file_url: up.file_url,
        source: "manual",
      });
      refresh();
      onOpenChange(false);
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unconditional Lien Release</DialogTitle>
          <DialogDescription>
            One per vendor per client. Pre-filled from this draw — review the fields, then generate or upload a signed copy.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm mb-2">
          <div className="flex justify-between"><span className="text-slate-500">Vendor (Claimant):</span><span className="font-medium text-slate-900">{vendorName}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Project:</span><span className="font-medium text-slate-900">{drawCycle?.project_name || projectName || "—"}</span></div>
        </div>

        <LienFormFields values={fields} onChange={setFields} />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-900">Generate pre-filled form</span>
            </div>
            <Button size="sm" onClick={handleGenerate} disabled={!!busy}>
              {busy === "generate" ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Generating...</> : "Generate & Save"}
            </Button>
          </div>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-900">Upload signed copy</span>
            </div>
            <label className="cursor-pointer">
              <span className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground h-8 px-3 text-xs font-medium">
                {busy === "upload" ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Uploading...</> : "Choose File"}
              </span>
              <input type="file" className="hidden" accept="application/pdf,image/*" onChange={handleUpload} disabled={!!busy} />
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}