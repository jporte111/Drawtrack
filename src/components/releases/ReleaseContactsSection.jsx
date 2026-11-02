import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Mail, Pencil, Plus, UserMinus, UserCheck } from "lucide-react";
import ClientContactDialog from "./ClientContactDialog";
import { roleLabel } from "./contactRoles";

export default function ReleaseContactsSection({ clientId }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["clientContacts", clientId],
    queryFn: () => base44.entities.ClientContact.filter({ client_id: clientId }, { sort: "name", limit: 100 }),
    enabled: !!clientId,
    select: (result) => (Array.isArray(result) ? result : result.items || []),
  });

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (contact) => {
    setEditing(contact);
    setDialogOpen(true);
  };

  const toggleActive = async (contact) => {
    await base44.entities.ClientContact.update(contact.id, { active: !contact.active });
    queryClient.invalidateQueries({ queryKey: ["clientContacts", clientId] });
  };

  return (
    <div className="bg-white border rounded-xl">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Release contacts</h2>
          <p className="text-xs text-slate-500">Everyone here is emailed each waiver and release for this client</p>
        </div>
        <Button size="sm" onClick={openAdd}><Plus className="w-4 h-4 mr-1" />Add contact</Button>
      </div>

      {isLoading ? (
        <div className="px-4 py-8 text-center text-sm text-slate-400">Loading...</div>
      ) : contacts.length === 0 ? (
        <div className="px-4 py-10 text-center text-slate-400">
          <Mail className="w-9 h-9 mx-auto mb-2 text-slate-300" />
          <p className="text-sm">No release contacts yet. Add the owner, lender and architect to start emailing releases.</p>
        </div>
      ) : (
        <div className="divide-y">
          {contacts.map((contact) => (
            <div key={contact.id} className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-medium ${contact.active === false ? "text-slate-400 line-through" : "text-slate-900"}`}>
                    {contact.name || contact.email}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{roleLabel(contact.role)}</span>
                  {contact.receives_releases === false && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Not emailed</span>
                  )}
                  {contact.active === false && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">Inactive</span>
                  )}
                </div>
                <a href={`mailto:${contact.email}`} className="text-sm text-blue-600 hover:underline break-all">{contact.email}</a>
                {contact.phone && <span className="text-xs text-slate-500 ml-2">{contact.phone}</span>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => openEdit(contact)}>
                  <Pencil className="w-3.5 h-3.5 mr-1" />Edit
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => toggleActive(contact)}>
                  {contact.active === false ? (
                    <><UserCheck className="w-3.5 h-3.5 mr-1" />Reactivate</>
                  ) : (
                    <><UserMinus className="w-3.5 h-3.5 mr-1" />Deactivate</>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {dialogOpen && (
        <ClientContactDialog
          open
          onOpenChange={(open) => { if (!open) { setDialogOpen(false); setEditing(null); } }}
          clientId={clientId}
          contact={editing}
        />
      )}
    </div>
  );
}