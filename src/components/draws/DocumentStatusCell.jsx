import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { statusConfig } from "@/lib/statusConfig";

const DOC_STATUSES = ["missing", "pending_signature", "needs_correction", "pending_payment", "complete", "na"];
const FLAGGED_STATUSES = ["missing", "pending_signature", "needs_correction", "pending_payment"];

export default function DocumentStatusCell({ doc, drawId }) {
  const queryClient = useQueryClient();

  if (!doc) {
    return <span className="text-xs text-slate-300">—</span>;
  }

  const handleChange = async (status) => {
    const update = { status };
    if ((status === "pending_signature" || status === "needs_correction" || status === "complete") && !doc.received_date) {
      update.received_date = new Date().toISOString().split("T")[0];
    }
    await base44.entities.Document.update(doc.id, update);

    if (FLAGGED_STATUSES.includes(status)) {
      await base44.functions.invoke("createOpenItemFromDocument", {
        document_id: doc.id,
        draw_vendor_id: doc.draw_vendor_id,
        draw_cycle_id: drawId,
        document_type: doc.document_type,
        status,
        amount: doc.amount,
      });
    } else if (status === "complete" || status === "na") {
      await base44.functions.invoke("resolveOpenItemFromDocument", { document_id: doc.id });
    }

    queryClient.invalidateQueries({ queryKey: ["documents"] });
    queryClient.invalidateQueries({ queryKey: ["openItems", drawId] });
  };

  return (
    <Select value={doc.status} onValueChange={handleChange}>
      <SelectTrigger className="h-7 text-xs w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {DOC_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>{statusConfig[s]?.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}