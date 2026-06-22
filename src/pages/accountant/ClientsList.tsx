import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Users, Search, ChevronRight, Plus, X } from "lucide-react";

export function ClientsList() {
  const [clients, setClients] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [newClient, setNewClient] = useState({ cnpj: "", name: "", accountantCategory: "", integrationHash: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadClients = () => {
    fetch("/api/accountant/clients", {
      headers: { Authorization: `Bearer ${localStorage.getItem("accountantToken")}` }
    })
      .then(r => r.json())
      .then(data => setClients(data.clients));
  };

  useEffect(() => {
    loadClients();
  }, []);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await fetch("/api/accountant/clients", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("accountantToken")}` 
      },
      body: JSON.stringify(newClient)
    });
    setShowModal(false);
    setNewClient({ cnpj: "", name: "", accountantCategory: "", integrationHash: "" });
    setIsSubmitting(false);
    loadClients();
  };

  // Extract unique categories
  const categories = Array.from(new Set(clients.map(c => c.accountantCategory).filter(Boolean)));

  const filtered = clients.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.cnpj.includes(search);
    const matchCategory = categoryFilter === "all" || c.accountantCategory === categoryFilter;
    return matchSearch && matchCategory;
  });

  return (
    <div className="space-y-8 animate-in fade-in relative">
      <header className="h-16 flex items-center justify-between px-8 bg-white/40 backdrop-blur-md border border-white rounded-2xl shadow-sm -mx-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Clientes</h1>
          <p className="text-xs text-slate-500">Gerencie a carteira de clientes do escritório.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center shadow-md hover:bg-slate-800 transition-colors">
          <Plus className="w-4 h-4 mr-2" /> Novo Cliente
        </button>
      </header>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 w-full max-w-md relative">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
               <X className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-slate-900 mb-6">Cadastrar Cliente</h2>
            <form onSubmit={handleCreateClient} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">CNPJ</label>
                <input required type="text" value={newClient.cnpj} onChange={(e) => setNewClient({...newClient, cnpj: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white" placeholder="00.000.000/0001-00" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Razão Social</label>
                <input required type="text" value={newClient.name} onChange={(e) => setNewClient({...newClient, name: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white" placeholder="Empresa XPTO Ltda" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Categoria (Opcional)</label>
                <input type="text" value={newClient.accountantCategory} onChange={(e) => setNewClient({...newClient, accountantCategory: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white" placeholder="Ex: Lucro Presumido, Simples Nacional..." />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Hash / Token Integração Externa (Opcional)</label>
                <input type="text" value={newClient.integrationHash} onChange={(e) => setNewClient({...newClient, integrationHash: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white" placeholder="Código identificador do sistema externo" />
              </div>
              <button disabled={isSubmitting} type="submit" className="w-full py-2 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-md hover:opacity-90">
                {isSubmitting ? "Salvando..." : "Salvar Cliente"}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white/80 backdrop-blur-xl border text-slate-900 border-white rounded-3xl overflow-hidden shadow-xl shadow-slate-200/50">
        <div className="p-4 border-b border-white flex gap-4 bg-white/50 flex-col sm:flex-row">
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
          <div className="flex-none">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="all">Todas as Categorias</option>
              {categories.map((cat: any) => (
                 <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
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
                  <div className="flex items-center space-x-2 mt-0.5">
                     <p className="text-xs text-slate-500">{client.cnpj}</p>
                     {client.accountantCategory && (
                       <>
                         <span className="text-xs text-slate-300">•</span>
                         <span className="text-xs text-slate-600 font-medium bg-slate-100 px-1.5 py-0.5 rounded-md">{client.accountantCategory}</span>
                       </>
                     )}
                  </div>
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
          {filtered.length === 0 && (
             <div className="p-8 text-center text-slate-500">Nenhum cliente encontrado.</div>
          )}
        </div>
      </div>
    </div>
  );
}
