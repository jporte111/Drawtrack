import React from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ArrowLeft } from "lucide-react";
import ReleaseContactsSection from "@/components/releases/ReleaseContactsSection";
import ReleaseEmailLogTable from "@/components/releases/ReleaseEmailLogTable";

export default function ReleaseContacts() {
  const { clientId } = useParams();

  const { data: client } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => base44.entities.Client.get(clientId),
    enabled: !!clientId,
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["releaseEmailLogs", "client", clientId],
    queryFn: () => base44.entities.ReleaseEmailLog.filter({ client_id: clientId }, { sort: "-sent_at", limit: 50 }),
    enabled: !!clientId,
    select: (result) => (Array.isArray(result) ? result : result.items || []),
  });

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-3">
        <ArrowLeft className="w-4 h-4" />All clients
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Release contacts</h1>
        <p className="text-sm text-slate-500">
          {client ? `${client.name}${client.project_name ? ` · ${client.project_name}` : ""}` : "Loading client..."}
        </p>
      </div>

      <ReleaseContactsSection clientId={clientId} />

      <div className="bg-white border rounded-xl mt-6">
        <div className="px-4 py-3 border-b">
          <h2 className="text-base font-semibold text-slate-900">Release emails</h2>
          <p className="text-xs text-slate-500">Every waiver and release emailed for this client</p>
        </div>
        <ReleaseEmailLogTable logs={logs} isLoading={logsLoading} />
      </div>
    </div>
  );
}