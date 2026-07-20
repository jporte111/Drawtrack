import { Outlet, Link, useLocation } from "react-router-dom";
import { HardHat, ClipboardList, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Draws", path: "/", icon: ClipboardList },
  { label: "Vendors", path: "/vendors", icon: Users },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-60 bg-slate-900 flex flex-col shrink-0">
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
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}