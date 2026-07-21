import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileText, Download, Loader2, RotateCcw } from "lucide-react";
import { formatCurrency } from "@/lib/format";

export default function GenerateLienReleasesDialog({ open, onOpenChange, vendorName, projectName, drawAmount }) {
  const [generating, setGenerating] = useState(null);
  const [results, setResults] = useState({});
  const [error, setError] = useState(null);

  const handleGenerate = async (formType) => {
    setGenerating(formType);
    setError(null);
    try {
      const response = await base44.functions.invoke('generateLienReleaseForm', {
        form_type: formType,
        vendor_name: vendorName,
        project_name: projectName,
        draw_amount: drawAmount,
      });
      setResults({ ...results, [formType]: response.data });
    } catch (err) {
      setError(err.message || "Failed to generate form");
    } finally {
      setGenerating(null);
    }
  };

  const handleDownload = (result) => {
    const byteCharacters = atob(result.pdf_base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate Lien Release Forms</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Vendor (Claimant):</span><span className="font-medium text-slate-900">{vendorName}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Project (Job Location):</span><span className="font-medium text-slate-900">{projectName}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Draw Amount:</span><span className="font-medium text-slate-900">{formatCurrency(drawAmount)}</span></div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="space-y-3">
            {["conditional", "unconditional"].map((formType) => (
              <div key={formType} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium capitalize text-slate-900">{formType} Lien Release</span>
                </div>
                {results[formType] ? (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleDownload(results[formType])}>
                      <Download className="w-4 h-4 mr-1" /> Download
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleGenerate(formType)} title="Regenerate">
                      <RotateCcw className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" onClick={() => handleGenerate(formType)} disabled={generating === formType}>
                    {generating === formType
                      ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Generating...</>
                      : "Generate"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}