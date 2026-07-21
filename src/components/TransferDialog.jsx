import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function TransferDialog({ open, onOpenChange, entityType, itemId, currentClientId, itemName }) {
  const queryClient = useQueryClient();
  const [targetClientId, setTargetClientId] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => base44.entities.Client.list("-created_date"),
  });

  const handleSubmit = async () => {
    if (!targetClientId) return;
    setSaving(true);
    try {
      await base44.entities[entityType].update(itemId, { client_id: targetClientId });
      queryClient.invalidateQueries({ queryKey: ["draws"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      onOpenChange(false);
      setTargetClientId("");
    } finally {
      setSaving(false);
    }
  };

  const label = entityType === "DrawCycle" ? "Draw" : "Vendor";

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setTargetClientId(""); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer {label}</DialogTitle>
          <DialogDescription>Move &ldquo;{itemName}&rdquo; to a different client.</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Select value={targetClientId} onValueChange={setTargetClientId}>
            <SelectTrigger><SelectValue placeholder="Select destination client" /></SelectTrigger>
            <SelectContent>
              {clients.filter((c) => c.id !== currentClientId).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={handleSubmit} disabled={!targetClientId || saving}>
            {saving ? "Transferring..." : "Transfer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}