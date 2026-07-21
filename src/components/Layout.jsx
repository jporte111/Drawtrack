import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { HardHat, ClipboardList, Users, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Draws", path: "/", icon: ClipboardList },
  { label: "Vendors", path: "/vendors", icon: Users },
];

export default function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const active = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                active ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 border-t border-slate-800 text-xs text-slate-500">
        Internal Tool · 3 Users
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="w-60 bg-slate-900 flex flex-col shrink-0 hidden lg:flex">
        {navContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-60 bg-slate-900 flex flex-col h-full">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute right-3 top-4 text-slate-400 hover:text-white z-10"
            >
              <X className="w-5 h-5" />
            </button>
            {navContent}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
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