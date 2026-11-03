import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Pencil, Send } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import DrawFormDialog from "@/components/draws/DrawFormDialog";
import InvoiceLedger from "@/components/draws/InvoiceLedger";
import LenderReconciliation from "@/components/draws/LenderReconciliation";
import VoucherSection from "@/components/draws/VoucherSection";

export default function DrawDetail() {
  const { id } = useParams();
  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSubmitDraw = async () => {
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke("submitDraw", { draw_cycle_id: id });
      toast({
        title: "Draw submitted",
        description: res.data?.submittedName ? `Renamed to "${res.data.submittedName}"` : "Next draw created",
      });
      queryClient.invalidateQueries({ queryKey: ["draw", id] });
      queryClient.invalidateQueries({ queryKey: ["draws"] });
      queryClient.invalidateQueries({ queryKey: ["drawCycle", id] });
    } catch (e) {
      toast({ variant: "destructive", title: "Submit failed", description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  const { data: draw, isLoading } = useQuery({
    queryKey: ["draw", id],
    queryFn: () => base44.entities.DrawCycle.get(id),
  });

  const { data: client } = useQuery({
    queryKey: ["client", draw?.client_id],
    queryFn: () => base44.entities.Client.get(draw.client_id),
    enabled: !!draw?.client_id,
  });

  const showLenders = client?.track_lenders !== false;
  const showVouchers = client?.track_vouchers !== false;

  if (isLoading) {
    return <div className="p-8 text-slate-400">Loading...</div>;
  }
  if (!draw) {
    return <div className="p-8 text-slate-400">Draw not found.</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <Link to={draw.client_id ? `/clients/${draw.client_id}/draws` : "/"} className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 mb-3">
        <ChevronLeft className="w-4 h-4" />Draws
      </Link>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-900">{draw.name}</h1>
            <StatusBadge status={draw.status} />
          </div>
          <p className="text-slate-500">{draw.project_name}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-slate-500">
            {draw.draw_date && <span>Date: {formatDate(draw.draw_date)}</span>}
            <span>Amount: {formatCurrency(draw.amount)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {(draw.status === "draft" || draw.status === "in_progress") && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" disabled={submitting}>
                  <Send className="w-3.5 h-3.5 mr-1.5" />{submitting ? "Submitting..." : "Submit Draw"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Submit this draw?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This renames the draw by its date, marks it submitted, and creates the next "Next Draw" for this project.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSubmitDraw}>Submit</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="w-3.5 h-3.5 mr-1.5" />Edit
          </Button>
        </div>
      </div>

      {showLenders && (
        <div className="bg-white border rounded-xl p-4 md:p-5 mb-4">
          <LenderReconciliation drawId={id} />
        </div>
      )}
      <div className="bg-white border rounded-xl p-4 md:p-5 mb-4">
        <InvoiceLedger drawId={id} />
      </div>
      {showVouchers && (
        <div className="bg-white border rounded-xl p-4 md:p-5">
          <VoucherSection drawId={id} />
        </div>
      )}

      <DrawFormDialog open={editOpen} onOpenChange={setEditOpen} draw={draw} showLenderFields={showLenders} />
    </div>
  );
}