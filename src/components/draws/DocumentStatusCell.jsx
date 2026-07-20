import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { statusConfig } from "@/lib/statusConfig";

const DOC_STATUSES = ["not_requested", "requested", "received", "approved", "rejected", "complete", "na"];

export default function DocumentStatusCell({ doc, drawId }) {
  const queryClient = useQueryClient();

  if (!doc) {
    return <span className="text-xs text-slate-300">—</span>;
  }

  const handleChange = async (status) => {
    const update = { status };
    if ((status === "received" || status === "approved") && !doc.received_date) {
      update.received_date = new Date().toISOString().split("T")[0];
    }
    await base44.entities.Document.update(doc.id, update);
    queryClient.invalidateQueries({ queryKey: ["documents"] });
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