import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Plus, ClipboardList, Users, Building2, DollarSign, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import ClientFormDialog from "@/components/clients/ClientFormDialog";
import ClientActionsMenu from "@/components/clients/ClientActionsMenu";

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
  const { data: openItems = [] } = useQuery({
    queryKey: ["openItems", "all"],
    queryFn: () => base44.entities.OpenItem.list(null, 500),
  });

  const ACTIVE = ["draft", "in_progress", "submitted", "under_review"];
  const activeDrawByClient = draws.reduce((acc, d) => {
    const cur = acc[d.client_id];
    const isMoreRecent = !cur || new Date(d.created_date) > new Date(cur.created_date);
    if (d.client_id && isMoreRecent && (ACTIVE.includes(d.status) || !cur)) {
      acc[d.client_id] = d;
    }
    return acc;
  }, {});
  const pendingByClient = openItems.reduce((acc, i) => {
    if (i.client_id && (i.status === "open" || i.status === "in_progress")) {
      acc[i.client_id] = (acc[i.client_id] || 0) + 1;
    }
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
                <ClientActionsMenu client={client} onEdit={handleEdit} />
              </div>
              {(() => {
                const active = activeDrawByClient[client.id];
                const pending = pendingByClient[client.id] || 0;
                return (
                  <div className="mb-4">
                    <div className="text-xs text-slate-500 mb-1">Active Draw</div>
                    {active ? (
                      <Link to={`/draws/${active.id}`} className="block font-medium text-slate-900 hover:text-blue-600 truncate">
                        {active.name}
                      </Link>
                    ) : (
                      <div className="text-sm text-slate-400">No active draw</div>
                    )}
                    {pending > 0 && (
                      <Link to={active ? `/draws/${active.id}` : `/clients/${client.id}/draws`} className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-amber-600 hover:text-amber-700">
                        <FileWarning className="w-3.5 h-3.5" />{pending} pending item{pending === 1 ? "" : "s"}
                      </Link>
                    )}
                  </div>
                );
              })()}
              <div className="grid grid-cols-3 gap-1.5 mt-auto">
                <Link to={`/clients/${client.id}/draws`}>
                  <Button variant="outline" size="sm" className="w-full px-2 gap-1 text-xs">
                    <ClipboardList className="w-3.5 h-3.5" />Draws
                  </Button>
                </Link>
                <Link to={`/clients/${client.id}/vendors`}>
                  <Button variant="outline" size="sm" className="w-full px-2 gap-1 text-xs">
                    <Users className="w-3.5 h-3.5" />Vendors
                  </Button>
                </Link>
                <Link to={`/clients/${client.id}/budget`}>
                  <Button variant="outline" size="sm" className="w-full px-2 gap-1 text-xs">
                    <DollarSign className="w-3.5 h-3.5" />Budget
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