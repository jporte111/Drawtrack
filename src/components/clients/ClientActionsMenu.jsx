import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function ClientActionsMenu({ client, onEdit }) {
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const draws = await base44.entities.DrawCycle.filter({ client_id: client.id });
      for (const draw of draws) {
        const drawVendors = await base44.entities.DrawVendor.filter({ draw_cycle_id: draw.id });
        for (const dv of drawVendors) {
          await base44.entities.Document.deleteMany({ draw_vendor_id: dv.id });
          await base44.entities.Voucher.deleteMany({ draw_vendor_id: dv.id });
        }
        await base44.entities.DrawVendor.deleteMany({ draw_cycle_id: draw.id });
        await base44.entities.Voucher.deleteMany({ draw_cycle_id: draw.id });
        await base44.entities.OpenItem.deleteMany({ draw_cycle_id: draw.id });
        await base44.entities.DrawCycle.delete(draw.id);
      }

      const vendors = await base44.entities.Vendor.filter({ client_id: client.id });
      for (const vendor of vendors) {
        await base44.entities.DrawVendor.deleteMany({ vendor_id: vendor.id });
        await base44.entities.Vendor.delete(vendor.id);
      }

      await base44.entities.Client.delete(client.id);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["draws"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(client)}>
            <Pencil className="w-4 h-4 mr-2" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="text-red-600">
            <Trash2 className="w-4 h-4 mr-2" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{client.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the client and all associated draws, vendors, documents, vouchers, and open items. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}