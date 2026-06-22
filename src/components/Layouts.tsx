import { Outlet, Navigate, Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Folder, Upload, LogOut, Settings, Users, Calculator } from "lucide-react";
import { cn } from "../lib/utils";
import { ThemeToggle } from "./ThemeToggle";

export function ClientLayout() {
  const token = localStorage.getItem("clientToken") || sessionStorage.getItem("clientToken");
  const user = JSON.parse(localStorage.getItem("clientUser") || sessionStorage.getItem("clientUser") || "{}");
  const location = useLocation();
  const navigate = useNavigate();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
    localStorage.removeItem("clientToken");
    localStorage.removeItem("clientUser");
    sessionStorage.removeItem("clientToken");
    sessionStorage.removeItem("clientUser");
    navigate("/login");
  };

  const menu = [
    { name: "Painel Resumo", path: "/dashboard", icon: LayoutDashboard },
    { name: "Cofre Digital", path: "/vault", icon: Folder },
    { name: "Meus Envios", path: "/uploads", icon: Upload },
  ];

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans overflow-hidden transition-colors">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl z-20">
        <div className="h-20 flex items-center px-6">
          <div className="flex items-center space-x-3">
             <div className="w-12 h-12 bg-virgula-card rounded-xl border border-white/10 flex items-center justify-center text-virgula-green shadow-[0_0_20px_rgba(16,185,129,0.25)] shrink-0">
               <Calculator strokeWidth={2.5} className="w-[30px] h-[30px]" />
             </div>
             <div className="flex flex-col justify-center">
                <span className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-none mb-0.5">Vírgula</span>
                <span className="text-base font-semibold text-virgula-green tracking-widest leading-none uppercase">Contábil</span>
             </div>
          </div>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1">
          {menu.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active ? "bg-virgula-green/10 text-virgula-green dark:bg-virgula-green/20" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50"
                )}
              >
                <Icon className={cn("w-5 h-5 mr-3", active ? "text-virgula-green" : "text-slate-400")} />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-200 dark:border-slate-700/50">
          <div className="flex items-center px-3 py-2">
             <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold mr-3 shrink-0">
               {user.name?.charAt(0) || "C"}
             </div>
             <div className="flex flex-col overflow-hidden">
               <span className="text-sm font-medium text-slate-900 dark:text-white truncate">{user.name}</span>
               <span className="text-xs text-slate-500 dark:text-slate-400 truncate">Cliente</span>
             </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-2 w-full flex items-center px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-virgula-green/5 via-transparent to-transparent -z-0"></div>
        <div className="flex-1 overflow-auto z-10">
          <div className="max-w-7xl mx-auto p-8 relative">
            <div className="absolute top-8 right-8 z-50">
               <ThemeToggle />
            </div>
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}

export function AccountantLayout() {
  const token = localStorage.getItem("accountantToken");
  const location = useLocation();
  const navigate = useNavigate();

  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }

  const handleLogout = () => {
    localStorage.removeItem("accountantToken");
    navigate("/admin/login");
  };

  const menu = [
    { name: "Inbox", path: "/admin", icon: Upload },
    { name: "Clientes", path: "/admin/clients", icon: Users },
  ];

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans overflow-hidden transition-colors">
      <aside className="w-64 bg-slate-900 dark:bg-slate-950 border-r border-slate-800 flex flex-col z-20 shadow-2xl">
        <div className="h-20 flex items-center px-6">
          <div className="flex items-center space-x-3">
             <div className="w-12 h-12 bg-virgula-card rounded-xl border border-white/10 flex items-center justify-center text-virgula-green shadow-[0_0_20px_rgba(16,185,129,0.25)] shrink-0">
               <Calculator strokeWidth={2.5} className="w-[30px] h-[30px]" />
             </div>
             <div className="flex flex-col justify-center">
                <span className="text-3xl font-bold text-white tracking-tight leading-none mb-0.5">Vírgula</span>
                <span className="text-base font-semibold text-virgula-green tracking-widest leading-none uppercase">Contábil</span>
             </div>
          </div>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1">
          {menu.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path || (location.pathname.startsWith('/admin/client/') && item.path === '/admin/clients');
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active ? "bg-slate-800 text-white shadow-inner" : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                )}
              >
                <Icon className={cn("w-5 h-5 mr-3", active ? "text-virgula-green" : "text-slate-500")} />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-800">
           <button
            onClick={handleLogout}
            className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <span>Sair do sistema</span>
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-virgula-green/5 via-transparent to-transparent -z-0"></div>
        <div className="flex-1 overflow-auto z-10">
          <div className="max-w-7xl mx-auto p-8 relative">
            <div className="absolute top-8 right-8 z-50">
               <ThemeToggle />
            </div>
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
