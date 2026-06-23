import { useState } from "react";
import { Send, Bell } from "lucide-react";

export function AccountantNotifications() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ userId: "", title: "", body: "" });

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/notifications/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accountantToken")}`
        },
        body: JSON.stringify(form)
      });
      if (res.ok) {
        alert("Notificação enviada com sucesso!");
        setForm({ userId: "", title: "", body: "" });
      } else {
        alert("Erro ao enviar notificação.");
      }
    } catch (err: any) {
      alert("Erro de conexão: " + err.message);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <header className="h-16 flex items-center px-8 bg-white/40 backdrop-blur-md border border-white rounded-2xl shadow-sm -mx-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Notificações Push</h1>
          <p className="text-xs text-slate-500">Disparar alertas para os clientes via Push (Service Worker).</p>
        </div>
      </header>

      <div className="bg-white/80 backdrop-blur-xl border border-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 max-w-xl">
         <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center"><Bell className="w-4 h-4 mr-2" /> Nova Notificação</h2>
         <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">ID do Usuário (Client ID)</label>
              <input 
                type="text" 
                required 
                value={form.userId}
                onChange={e => setForm({...form, userId: e.target.value})}
                placeholder="Ex: 101" 
                className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
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
    </div>
  );
}
