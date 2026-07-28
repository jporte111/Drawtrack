import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { statusConfig } from "@/lib/statusConfig";

const DOC_STATUSES = ["missing", "pending_signature", "needs_correction", "pending_payment", "complete", "na"];

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

    if (status === "complete" || status === "na") {
      const today = new Date().toISOString().split("T")[0];
      const items = await base44.entities.OpenItem.filter({ document_id: doc.id });
      await Promise.all(
        items
          .filter((i) => i.status === "open" || i.status === "in_progress")
          .map((i) => base44.entities.OpenItem.update(i.id, { status: "resolved", resolved_date: today }))
      );
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