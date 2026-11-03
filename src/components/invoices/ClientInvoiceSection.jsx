import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Eye, Pencil, Trash2, FileText } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import StatusBadge from "@/components/StatusBadge";
import { invoiceStatusConfig } from "@/lib/invoiceStatus";
import { formatCurrency, formatDate } from "@/lib/format";
import ClientInvoiceDialog from "./ClientInvoiceDialog";
import ClientInvoiceViewDialog from "./ClientInvoiceViewDialog";

export default function ClientInvoiceSection({ drawId }) {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["clientInvoices", drawId],
    queryFn: () => base44.entities.ClientInvoice.filter({ draw_cycle_id: drawId }),
    enabled: !!drawId,
  });

  const sorted = useMemo(
    () => invoices.slice().sort((a, b) => String(b.created_date || "").localeCompare(String(a.created_date || ""))),
    [invoices],
  );

  const startNew = () => {
    if (sorted.some((inv) => inv.status !== "void")) {
      setDuplicateOpen(true);
      return;
    }
    openNew();
  };

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (invoice) => {
    setEditing(invoice);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await base44.entities.ClientInvoice.delete(deleteTarget.id);
    setDeleteTarget(null);
    queryClient.invalidateQueries({ queryKey: ["clientInvoices", drawId] });
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Client Invoices</h2>
          <p className="text-sm text-slate-500">Invoice the client for this draw</p>
        </div>
        <Button size="sm" onClick={startNew}>
          <Plus className="w-4 h-4 mr-1" />New Invoice
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-6 text-sm text-slate-400">Loading invoices...</div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-8 text-slate-400 border border-dashed rounded-lg">
          <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          No client invoice for this draw yet.
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-3 py-2.5 font-semibold">Invoice #</th>
                <th className="px-3 py-2.5 font-semibold">Date</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-3 py-2.5 font-semibold text-right">Total</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((invoice) => (
                <tr key={invoice.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-medium text-slate-900">{invoice.invoice_number}</td>
                  <td className="px-3 py-2.5 text-slate-600">{formatDate(invoice.invoice_date)}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={invoice.status} config={invoiceStatusConfig} /></td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium text-slate-900">{formatCurrency(invoice.total || 0)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-900" onClick={() => setViewing(invoice)} title="View & send">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-900" onClick={() => openEdit(invoice)} title="Edit">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => setDeleteTarget(invoice)} title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ClientInvoiceDialog open={formOpen} onOpenChange={setFormOpen} drawId={drawId} invoice={editing} />
      <ClientInvoiceViewDialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)} invoice={viewing} />

      <AlertDialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>This draw already has a client invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Create another invoice for this draw anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={openNew}>Create Another</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete invoice {deleteTarget?.invoice_number}?</AlertDialogTitle>
            <AlertDialogDescription>This permanently deletes the invoice and its line items.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}