import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, Search, ChevronRight } from "lucide-react";

export function ClientsList() {
  const [clients, setClients] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/accountant/clients", {
      headers: { Authorization: `Bearer ${localStorage.getItem("accountantToken")}` }
    })
      .then(r => r.json())
      .then(data => setClients(data.clients));
  }, []);

  const filtered = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.cnpj.includes(search));

  return (
    <div className="space-y-8 animate-in fade-in">
      <header className="h-16 flex items-center justify-between px-8 bg-white/40 backdrop-blur-md border border-white rounded-2xl shadow-sm -mx-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Clientes</h1>
          <p className="text-xs text-slate-500">Gerencie a carteira de clientes do escritório.</p>
        </div>
      </header>

      <div className="bg-white/80 backdrop-blur-xl border text-slate-900 border-white rounded-3xl overflow-hidden shadow-xl shadow-slate-200/50">
        <div className="p-4 border-b border-white flex gap-4 bg-white/50">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por nome ou CNPJ..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent outline-none bg-white"
            />
          </div>
        </div>

        <div className="divide-y divide-slate-100/50">
          {filtered.map(client => (
            <Link 
              key={client.id} 
              to={`/admin/client/${client.id}`}
              className="flex items-center justify-between p-4 px-6 hover:bg-white transition-colors group"
            >
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-semibold text-sm mr-4 group-hover:bg-slate-200 transition-colors">
                  {client.name.charAt(0)}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-900">{client.name}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{client.cnpj}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={`px-2.5 py-1 text-[10px] uppercase tracking-wider font-semibold rounded-full ${
                  client.regularityStatus === 'green' ? 'bg-emerald-100 text-emerald-700' :
                  client.regularityStatus === 'warning' ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {client.regularityStatus === 'green' ? 'Regular' : client.regularityStatus === 'warning' ? 'Atenção' : 'Irregular'}
                </span>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-600 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
