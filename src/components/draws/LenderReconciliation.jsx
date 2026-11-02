import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { formatCurrency } from "@/lib/format";

export default function LenderReconciliation({ drawId }) {
  const queryClient = useQueryClient();
  const [savingField, setSavingField] = useState(null);
  const [lenderDraft, setLenderDraft] = useState("");

  const { data: draw } = useQuery({
    queryKey: ["draw", drawId],
    queryFn: () => base44.entities.DrawCycle.get(drawId),
  });
  const { data: drawVendors = [] } = useQuery({
    queryKey: ["drawVendors", drawId],
    queryFn: () => base44.entities.DrawVendor.filter({ draw_cycle_id: drawId }),
  });
  const { data: allDocs = [] } = useQuery({
    queryKey: ["documents"],
    queryFn: () => base44.entities.Document.list(),
  });

  const { base44Total, approvedTotal } = useMemo(() => {
    const dvIds = new Set(drawVendors.map((d) => d.id));
    const drawInvoices = allDocs.filter(
      (d) =>
        dvIds.has(d.draw_vendor_id) &&
        (d.document_type === "invoice" || d.document_type === "receipt")
    );
    return {
      base44Total: drawInvoices.reduce((s, d) => s + (d.amount || 0), 0),
      approvedTotal: drawInvoices
        .filter((d) => d.review_status === "approved")
        .reduce((s, d) => s + (d.amount || 0), 0),
    };
  }, [drawVendors, allDocs]);

  const lenderDue = draw?.lender_current_payment_due ?? null;

  // Keep the input draft in sync with the saved value (e.g. after refetch or edits elsewhere)
  useEffect(() => {
    setLenderDraft(lenderDue == null ? "" : String(lenderDue));
  }, [lenderDue]);

  const hasMismatch =
    lenderDue != null && Math.abs((lenderDue || 0) - base44Total) > 0.005;
  const difference = lenderDue != null ? (lenderDue || 0) - base44Total : 0;

  const updateDraw = async (patch) => {
    const key = Object.keys(patch)[0];
    setSavingField(key);
    try {
      await base44.entities.DrawCycle.update(drawId, patch);
      queryClient.invalidateQueries({ queryKey: ["draw", drawId] });
      queryClient.invalidateQueries({ queryKey: ["drawCycle", drawId] });
    } finally {
      setSavingField(null);
    }
  };

  const commitLender = () => {
    const trimmed = lenderDraft.trim();
    if (trimmed === "" || trimmed === String(lenderDue ?? "")) return;
    const num = Number(trimmed);
    updateDraw({ lender_current_payment_due: isNaN(num) ? null : num });
  };

  const useApproved = () => {
    setLenderDraft(String(approvedTotal));
    updateDraw({ lender_current_payment_due: approvedTotal });
  };

  return (
    <div>
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-slate-900">Lender Reconciliation</h2>
        <p className="text-sm text-slate-500">Base44 invoice total vs lender payment due</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <div className="rounded-lg border p-3">
          <div className="text-xs text-slate-500 mb-1">Base44 Invoice Total</div>
          <div className="text-xl font-bold text-slate-900 tabular-nums">{formatCurrency(base44Total)}</div>
          <div className="text-xs text-emerald-600 mt-1">{formatCurrency(approvedTotal)} approved</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">Lender Current Payment Due</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={useApproved}
              disabled={!!savingField}
              title="Set to the approved invoice total"
            >
              Use approved
            </Button>
          </div>
          <Input
            type="number"
            value={lenderDraft}
            placeholder="Enter lender amount"
            onChange={(e) => setLenderDraft(e.target.value)}
            onBlur={commitLender}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            disabled={!!savingField}
            className="text-xl font-bold tabular-nums h-9"
          />
        </div>
      </div>

      {hasMismatch ? (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span className="font-semibold tracking-wide">DRAW DOES NOT MATCH</span>
          <span className="text-sm">— off by {formatCurrency(Math.abs(difference))}</span>
        </div>
      ) : lenderDue != null ? (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg p-3 mb-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="font-medium">Draw matches lender payment due</span>
        </div>
      ) : (
        <div className="text-sm text-slate-400 mb-3">Enter the lender payment due to reconcile.</div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <DocLinkField
          label="Application Cert (AIA G702) — optional"
          value={draw?.application_cert_url}
          onSave={(v) => updateDraw({ application_cert_url: v || null })}
          saving={savingField === "application_cert_url"}
        />
        <DocLinkField
          label="Continuation Sheet (AIA G703) — optional"
          value={draw?.continuation_sheet_url}
          onSave={(v) => updateDraw({ continuation_sheet_url: v || null })}
          saving={savingField === "continuation_sheet_url"}
        />
      </div>
    </div>
  );
}

function DocLinkField({ label, value, onSave, saving }) {
  const [draft, setDraft] = useState(value || "");
  useEffect(() => setDraft(value || ""), [value]);
  return (
    <div>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft !== (value || "") && onSave(draft)}
          placeholder="Paste document link..."
          disabled={saving}
        />
        {value && (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-9 h-9 shrink-0 rounded-md border text-slate-500 hover:bg-slate-50"
            title="Open"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  );
}