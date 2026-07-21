import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Plus, ClipboardList, Users, Pencil, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ClientFormDialog from "@/components/clients/ClientFormDialog";

export default function ClientList() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: () => base44.entities.Client.list("-created_date"),
  });
  const { data: draws = [] } = useQuery({
    queryKey: ["draws"],
    queryFn: () => base44.entities.DrawCycle.list(),
  });
  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: () => base44.entities.Vendor.list(),
  });

  const drawsByClient = draws.reduce((acc, d) => {
    if (d.client_id) acc[d.client_id] = (acc[d.client_id] || 0) + 1;
    return acc;
  }, {});
  const vendorsByClient = vendors.reduce((acc, v) => {
    if (v.client_id) acc[v.client_id] = (acc[v.client_id] || 0) + 1;
    return acc;
  }, {});

  const handleEdit = (client) => {
    setEditingClient(client);
    setDialogOpen(true);
  };

  const handleOpenChange = (open) => {
    setDialogOpen(open);
    if (!open) setEditingClient(null);
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
          <p className="text-sm text-slate-500">Select a client to view their draws and vendors</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="shrink-0"><Plus className="w-4 h-4 mr-1.5" />New Client</Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-400">Loading...</div>
      ) : clients.length === 0 ? (
        <div className="text-center py-16 text-slate-400 border border-dashed rounded-xl">
          <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p>No clients yet. Click "New Client" to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => (
            <div key={client.id} className="bg-white border rounded-xl p-5 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">{client.name}</div>
                    {client.project_name && <div className="text-sm text-slate-500 truncate">{client.project_name}</div>}
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => handleEdit(client)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="text-center bg-slate-50 rounded-lg py-2">
                  <div className="text-lg font-bold text-slate-900">{drawsByClient[client.id] || 0}</div>
                  <div className="text-xs text-slate-500">Draws</div>
                </div>
                <div className="text-center bg-slate-50 rounded-lg py-2">
                  <div className="text-lg font-bold text-slate-900">{vendorsByClient[client.id] || 0}</div>
                  <div className="text-xs text-slate-500">Vendors</div>
                </div>
              </div>
              <div className="flex gap-2 mt-auto">
                <Link to={`/clients/${client.id}/draws`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    <ClipboardList className="w-3.5 h-3.5 mr-1" />Draws
                  </Button>
                </Link>
                <Link to={`/clients/${client.id}/vendors`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    <Users className="w-3.5 h-3.5 mr-1" />Vendors
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <ClientFormDialog open={dialogOpen} onOpenChange={handleOpenChange} client={editingClient} />
    </div>
  );
}