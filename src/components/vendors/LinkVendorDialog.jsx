import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function LinkVendorDialog({ open, onOpenChange, clientId }) {
  const queryClient = useQueryClient();
  const [vendorId, setVendorId] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: allVendors = [] } = useQuery({
    queryKey: ["vendors", "all"],
    queryFn: () => base44.entities.Vendor.list(),
  });
  const { data: clientVendors = [] } = useQuery({
    queryKey: ["clientVendors", clientId],
    queryFn: () => base44.entities.ClientVendor.filter({ client_id: clientId }),
    enabled: !!clientId,
  });

  const linkedIds = new Set(clientVendors.map((cv) => cv.vendor_id));
  const linkable = allVendors.filter((v) => !linkedIds.has(v.id));

  useEffect(() => { if (open) setVendorId(""); }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!vendorId) return;
    setSaving(true);
    try {
      await base44.entities.ClientVendor.create({ client_id: clientId, vendor_id: vendorId, status: "active" });
      queryClient.invalidateQueries({ queryKey: ["clientVendors", clientId] });
      queryClient.invalidateQueries({ queryKey: ["clientVendors", "all"] });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Link Existing Vendor</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-slate-500">Select a vendor from the master list to add to this client.</p>
          <Select value={vendorId} onValueChange={setVendorId}>
            <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
            <SelectContent>
              {linkable.length === 0 ? (
                <SelectItem value="__none" disabled>All vendors are already linked</SelectItem>
              ) : (
                linkable.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)
              )}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !vendorId}>{saving ? "Linking..." : "Link Vendor"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}