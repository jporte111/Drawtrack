import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import { vendorTypeConfig } from "@/lib/statusConfig";
import VendorFormDialog from "@/components/vendors/VendorFormDialog";

export default function VendorList() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => base44.entities.Vendor.list("-created_date"),
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
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vendor Master List</h1>
          <p className="text-sm text-slate-500">All vendors available for draw assignments</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-1.5" />New Vendor</Button>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
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

      <VendorFormDialog open={dialogOpen} onOpenChange={handleOpenChange} vendor={editingVendor} />
    </div>
  );
}