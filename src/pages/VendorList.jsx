import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Plus, Pencil, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import { vendorTypeConfig } from "@/lib/statusConfig";
import VendorFormDialog from "@/components/vendors/VendorFormDialog";

export default function VendorList() {
  const { clientId } = useParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);

  const { data: client } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => base44.entities.Client.get(clientId),
    enabled: !!clientId,
  });
  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ["vendors", clientId],
    queryFn: () => base44.entities.Vendor.filter({ client_id: clientId }),
  });

  const handleEdit = (vendor) => {
    setEditingVendor(vendor);
    setDialogOpen(true);
  };

  const handleOpenChange = (open) => {
    setDialogOpen(open);
    if (!open) setEditingVendor(null);
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <Link to="/" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 mb-3">
        <ChevronLeft className="w-4 h-4" />All Clients
      </Link>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{client?.name ? `${client.name} — Vendors` : "Vendors"}</h1>
          <p className="text-sm text-slate-500">All vendors for {client?.name || "this client"}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="shrink-0"><Plus className="w-4 h-4 mr-1.5" />New Vendor</Button>
      </div>

      {/* Desktop table */}
      <div className="bg-white border rounded-xl overflow-hidden hidden md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-slate-50 text-left">
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Vendor</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Phone</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
            ) : vendors.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">No vendors yet. Click "New Vendor" to get started.</td></tr>
            ) : (
              vendors.map((vendor) => (
                <tr key={vendor.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{vendor.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{vendorTypeConfig[vendor.vendor_type] || vendor.vendor_type}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{vendor.contact_name || "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{vendor.email || "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{vendor.phone || "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={vendor.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(vendor)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {isLoading ? (
          <div className="text-center py-8 text-slate-400">Loading...</div>
        ) : vendors.length === 0 ? (
          <div className="text-center py-12 text-slate-400 border border-dashed rounded-xl">No vendors yet. Click "New Vendor" to get started.</div>
        ) : (
          vendors.map((vendor) => (
            <div key={vendor.id} className="bg-white border rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="font-medium text-slate-900">{vendor.name}</div>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => handleEdit(vendor)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="text-sm text-slate-600 mb-1">{vendorTypeConfig[vendor.vendor_type] || vendor.vendor_type}</div>
              {vendor.contact_name && <div className="text-sm text-slate-600">{vendor.contact_name}</div>}
              {vendor.email && <div className="text-sm text-slate-600 truncate">{vendor.email}</div>}
              {vendor.phone && <div className="text-sm text-slate-600">{vendor.phone}</div>}
              <div className="mt-2"><StatusBadge status={vendor.status} /></div>
            </div>
          ))
        )}
      </div>

      <VendorFormDialog open={dialogOpen} onOpenChange={handleOpenChange} vendor={editingVendor} clientId={clientId} />
    </div>
  );
}