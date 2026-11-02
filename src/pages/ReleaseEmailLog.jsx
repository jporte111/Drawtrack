import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ReleaseEmailLogTable from "@/components/releases/ReleaseEmailLogTable";

export default function ReleaseEmailLog() {
  const [clientId, setClientId] = useState("all");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => base44.entities.Client.list("-created_date"),
  });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["releaseEmailLogs", "global", clientId],
    queryFn: () =>
      clientId === "all"
        ? base44.entities.ReleaseEmailLog.list({ sort: "-sent_at", limit: 200 })
        : base44.entities.ReleaseEmailLog.filter({ client_id: clientId }, { sort: "-sent_at", limit: 200 }),
    select: (result) => (Array.isArray(result) ? result : result.items || []),
  });

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Release emails</h1>
          <p className="text-sm text-slate-500">Waiver and release emails sent to client contacts</p>
        </div>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clients</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white border rounded-xl">
        <ReleaseEmailLogTable logs={logs} showClient isLoading={isLoading} />
      </div>
    </div>
  );
}