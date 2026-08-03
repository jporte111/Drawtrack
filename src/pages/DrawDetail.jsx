import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Pencil } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";
import DrawFormDialog from "@/components/draws/DrawFormDialog";
import OpenItemsSection from "@/components/draws/OpenItemsSection";
import VendorChecklist from "@/components/draws/VendorChecklist";
import VoucherSection from "@/components/draws/VoucherSection";

export default function DrawDetail() {
  const { id } = useParams();
  const [editOpen, setEditOpen] = useState(false);

  const { data: draw, isLoading } = useQuery({
    queryKey: ["draw", id],
    queryFn: () => base44.entities.DrawCycle.get(id),
  });

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
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="shrink-0">
          <Pencil className="w-3.5 h-3.5 mr-1.5" />Edit
        </Button>
      </div>

      <div className="bg-slate-50 border rounded-xl p-4 md:p-5 mb-4">
        <OpenItemsSection drawId={id} />
      </div>
      <div className="bg-white border rounded-xl p-4 md:p-5 mb-4">
        <VendorChecklist drawId={id} />
      </div>
      <div className="bg-white border rounded-xl p-4 md:p-5">
        <VoucherSection drawId={id} />
      </div>

      <DrawFormDialog open={editOpen} onOpenChange={setEditOpen} draw={draw} />
    </div>
  );
}