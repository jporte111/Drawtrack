import { useState, useEffect, useMemo } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { HardHat, ClipboardList, Users, Menu, X, ChevronDown, ChevronRight, FolderOpen, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedClients, setExpandedClients] = useState({});

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => base44.entities.Client.list("-created_date"),
  });

  const activeClientId = useMemo(() => {
    const match = location.pathname.match(/\/clients\/([^/]+)/);
    return match ? match[1] : null;
  }, [location.pathname]);

  useEffect(() => {
    if (activeClientId) {
      setExpandedClients((prev) => ({ ...prev, [activeClientId]: true }));
    }
  }, [activeClientId]);

  const toggleClient = (id) => {
    setExpandedClients((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const navContent = (
    <>
      <div className="px-5 py-5 flex items-center gap-2.5 border-b border-slate-800">
        <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
          <HardHat className="w-5 h-5 text-slate-900" />
        </div>
        <div>
          <div className="text-white font-semibold text-sm leading-tight">DrawManager</div>
          <div className="text-slate-400 text-xs">Construction Draws</div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <Link
          to="/"
          onClick={() => setSidebarOpen(false)}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            location.pathname === "/" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800/50"
          )}
        >
          <Building2 className="w-4 h-4" />
          All Clients
        </Link>

        <Link
          to="/vendors"
          onClick={() => setSidebarOpen(false)}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            location.pathname === "/vendors" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800/50"
          )}
        >
          <Users className="w-4 h-4" />
          All Vendors
        </Link>

        <div className="pt-3">
          <div className="px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wide">Clients</div>
          {clients.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-500">No clients yet</div>
          ) : (
            clients.map((client) => {
              const expanded = expandedClients[client.id] || activeClientId === client.id;
              const isActive = activeClientId === client.id;
              return (
                <div key={client.id}>
                  <button
                    onClick={() => toggleClient(client.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-full transition-colors",
                      isActive ? "text-white" : "text-slate-300 hover:text-white hover:bg-slate-800/50"
                    )}
                  >
                    {expanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                    <FolderOpen className="w-4 h-4 shrink-0" />
                    <span className="truncate flex-1 text-left">{client.name}</span>
                  </button>
                  {expanded && (
                    <div className="ml-4 border-l border-slate-800 pl-2 space-y-0.5">
                      <Link
                        to={`/clients/${client.id}/draws`}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors",
                          location.pathname === `/clients/${client.id}/draws` ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                        )}
                      >
                        <ClipboardList className="w-3.5 h-3.5" />
                        Draws
                      </Link>
                      <Link
                        to={`/clients/${client.id}/vendors`}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors",
                          location.pathname === `/clients/${client.id}/vendors` ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                        )}
                      >
                        <Users className="w-3.5 h-3.5" />
                        Vendors
                      </Link>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </nav>
      <div className="px-5 py-4 border-t border-slate-800 text-xs text-slate-500">
        Internal Tool · {clients.length} {clients.length === 1 ? "Client" : "Clients"}
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-60 bg-slate-900 flex flex-col shrink-0 hidden lg:flex">
        {navContent}
      </aside>
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-60 bg-slate-900 flex flex-col h-full">
            <button onClick={() => setSidebarOpen(false)} className="absolute right-3 top-4 text-slate-400 hover:text-white z-10">
              <X className="w-5 h-5" />
            </button>
            {navContent}
          </aside>
        </div>
      )}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-300 hover:text-white">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center">
              <HardHat className="w-4 h-4 text-slate-900" />
            </div>
            <span className="text-white font-semibold text-sm">DrawManager</span>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}