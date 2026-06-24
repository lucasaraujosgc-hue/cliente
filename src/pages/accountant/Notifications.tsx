import React, { useState, useEffect } from "react";
import { Send, Bell, CheckSquare, Square } from "lucide-react";

export function AccountantNotifications() {
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [form, setForm] = useState({ title: "", body: "" });

  useEffect(() => {
    fetch("/api/accountant/clients", {
      headers: { Authorization: `Bearer ${localStorage.getItem("accountantToken")}` }
    })
      .then(res => res.json())
      .then(data => setClients(data.clients || []));
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedClientIds.length === 0) {
      alert("Selecione pelo menos um cliente.");
      return;
    }
    
    setLoading(true);
    let successCount = 0;
    
    // In order to send in bulk or multiple, we will iterate and send for each userId.
    // Optionally we can adapt the backend to receive an array, but sending one by one is simple for now, 
    // or we can adjust the payload to take an array.
    try {
      const res = await fetch("/api/admin/notifications/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accountantToken")}`
        },
        body: JSON.stringify({
          userIds: selectedClientIds, // we will update backend to handle userIds
          title: form.title,
          body: form.body
        })
      });
      if (res.ok) {
        alert("Notificação enviada com sucesso!");
        setForm({ title: "", body: "" });
        setSelectedClientIds([]);
      } else {
        alert("Erro ao enviar notificação.");
      }
    } catch (err: any) {
      alert("Erro de conexão: " + err.message);
    }
    setLoading(false);
  };

  const toggleClient = (id: string) => {
    if (selectedClientIds.includes(id)) {
      setSelectedClientIds(selectedClientIds.filter(cId => cId !== id));
    } else {
      setSelectedClientIds([...selectedClientIds, id]);
    }
  };

  const toggleAll = () => {
    if (selectedClientIds.length === clients.length) {
      setSelectedClientIds([]);
    } else {
      setSelectedClientIds(clients.map(c => c.id));
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <header className="h-16 flex items-center px-8 bg-white/40 backdrop-blur-md border border-white rounded-2xl shadow-sm -mx-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Notificações Push</h1>
          <p className="text-xs text-slate-500">Disparar alertas para os clientes via Push (Service Worker).</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Formulário de Envio */}
        <div className="bg-white/80 backdrop-blur-xl border border-white rounded-3xl p-6 shadow-xl shadow-slate-200/50">
           <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center"><Bell className="w-4 h-4 mr-2" /> Nova Notificação</h2>
           <form onSubmit={handleSend} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Título</label>
                <input 
                  type="text" 
                  required 
                  value={form.title}
                  onChange={e => setForm({...form, title: e.target.value})}
                  placeholder="Ex: Alerta de Fatura" 
                  className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Mensagem (Body)</label>
                <textarea 
                  required 
                  value={form.body}
                  onChange={e => setForm({...form, body: e.target.value})}
                  placeholder="Sua fatura de R$ 99.00 vence amanhã." 
                  className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 min-h-[100px]"
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm px-4 py-3 rounded-xl flex items-center justify-center transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4 mr-2" /> {loading ? "Enviando..." : "Disparar Push Notification"}
              </button>
           </form>
        </div>

        {/* Lista de Clientes */}
        <div className="bg-white/80 backdrop-blur-xl border border-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 flex flex-col max-h-[500px]">
          <div className="flex items-center justify-between mb-4 shrink-0">
             <h2 className="text-sm font-bold text-slate-800">Selecione os Destinatários</h2>
             <button 
               type="button" 
               onClick={toggleAll}
               className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-md transition-colors"
             >
               {selectedClientIds.length === clients.length ? "Desmarcar Todos" : "Selecionar Todos"}
             </button>
          </div>
          <div className="overflow-y-auto pr-2 space-y-2 flex-1">
             {clients.length === 0 ? (
               <p className="text-sm text-slate-500 italic text-center py-4">Nenhum cliente encontrado.</p>
             ) : (
               clients.map(client => (
                 <div 
                   key={client.id} 
                   onClick={() => toggleClient(client.id)}
                   className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
                 >
                   {selectedClientIds.includes(client.id) ? (
                     <CheckSquare className="w-5 h-5 text-emerald-500 shrink-0" />
                   ) : (
                     <Square className="w-5 h-5 text-slate-300 shrink-0" />
                   )}
                   <div className="flex-1 min-w-0">
                     <p className="text-sm font-bold text-slate-800 truncate">{client.name}</p>
                     <p className="text-[10px] text-slate-500 truncate uppercase">
                       {client.accountantCategory || "Sem Categoria"} • {client.cnpj}
                     </p>
                   </div>
                 </div>
               ))
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
