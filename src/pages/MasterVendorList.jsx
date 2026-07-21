import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Plus, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import { vendorTypeConfig } from "@/lib/statusConfig";
import VendorFormDialog from "@/components/vendors/VendorFormDialog";
import VendorActionsMenu from "@/components/vendors/VendorActionsMenu";

export default function MasterVendorList() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ["vendors", "all"],
    queryFn: () => base44.entities.Vendor.list("-created_date"),
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => base44.entities.Client.list("-created_date"),
  });

  const clientMap = clients.reduce((acc, c) => { acc[c.id] = c.name; return acc; }, {});

  const handleEdit = (vendor) => { setEditingVendor(vendor); setDialogOpen(true); };
  const handleOpenChange = (open) => { setDialogOpen(open); if (!open) setEditingVendor(null); };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <Link to="/" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 mb-3">
        <ChevronLeft className="w-4 h-4" />All Clients
      </Link>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">All Vendors</h1>
          <p className="text-sm text-slate-500">Master vendor list across all clients</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="shrink-0"><Plus className="w-4 h-4 mr-1.5" />New Vendor</Button>
      </div>

      {/* Desktop table */}
      <div className="bg-white border rounded-xl overflow-hidden hidden md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-slate-50 text-left">
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Vendor</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Client</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Phone</th>
              <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
            ) : vendors.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">No vendors yet.</td></tr>
            ) : (
              vendors.map((vendor) => (
                <tr key={vendor.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{vendor.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{clientMap[vendor.client_id] || "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{vendorTypeConfig[vendor.vendor_type] || vendor.vendor_type}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{vendor.contact_name || "—"}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{vendor.phone || "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={vendor.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <VendorActionsMenu vendor={vendor} onEdit={() => handleEdit(vendor)} />
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
          <div className="text-center py-12 text-slate-400 border border-dashed rounded-xl">No vendors yet.</div>
        ) : (
          vendors.map((vendor) => (
            <div key={vendor.id} className="bg-white border rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="font-medium text-slate-900">{vendor.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{clientMap[vendor.client_id] || "Unassigned"}</div>
                </div>
                <VendorActionsMenu vendor={vendor} onEdit={() => handleEdit(vendor)} />
              </div>
              <div className="text-sm text-slate-600 mb-1">{vendorTypeConfig[vendor.vendor_type] || vendor.vendor_type}</div>
              {vendor.contact_name && <div className="text-sm text-slate-600">{vendor.contact_name}</div>}
              {vendor.phone && <div className="text-sm text-slate-600">{vendor.phone}</div>}
              <div className="mt-2"><StatusBadge status={vendor.status} /></div>
            </div>
          ))
        )}
      </div>

      <VendorFormDialog open={dialogOpen} onOpenChange={handleOpenChange} vendor={editingVendor} />
    </div>
  );
}