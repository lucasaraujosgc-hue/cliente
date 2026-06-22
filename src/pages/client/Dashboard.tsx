import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle, FileText, Copy, Bell } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function ClientDashboard() {
  const [data, setData] = useState<any>(null);
  const user = JSON.parse(localStorage.getItem("clientUser") || "{}");

  useEffect(() => {
    fetch("/api/client/dashboard", {
      headers: { Authorization: `Bearer ${localStorage.getItem("clientToken")}` }
    })
      .then(r => r.json())
      .then(setData);
  }, []);

  if (!data) return <div className="animate-pulse flex space-x-4"><div className="flex-1 space-y-4 py-1"><div className="h-4 bg-slate-200 rounded w-3/4"></div><div className="space-y-2"><div className="h-4 bg-slate-200 rounded"></div><div className="h-4 bg-slate-200 rounded w-5/6"></div></div></div></div>;

  const pendingDocs = data.documents.filter((d: any) => d.status === "pending" || d.status === "new");
  
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <header className="h-16 flex items-center justify-between px-8 bg-white/40 backdrop-blur-md border border-white rounded-2xl shadow-sm -mx-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Olá, {data.client.name}</h1>
          <p className="text-xs text-slate-500">Resumo da sua situação contábil.</p>
        </div>
      </header>

      {/* Alertas e Regularidade */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 md:col-span-2 space-y-4">
          {data.messages.filter((m:any) => !m.read).map((msg:any) => (
            <div key={msg.id} className="bg-blue-50/80 backdrop-blur-md border border-blue-100 rounded-2xl p-4 flex items-start shadow-sm shadow-blue-50">
              <Bell className="text-blue-500 w-5 h-5 mt-0.5 mr-3 shrink-0" />
              <div>
                <h4 className="font-medium text-blue-900 text-sm">Aviso do contador</h4>
                <p className="text-blue-800 text-sm mt-1">{msg.content}</p>
                <span className="text-xs text-blue-400 mt-2 block">{format(parseISO(msg.createdAt), "dd MMM, HH:mm", { locale: ptBR })}</span>
              </div>
            </div>
          ))}
          
          {pendingDocs.map((doc:any) => (
            <div key={doc.id} className="bg-amber-50/80 backdrop-blur-md border border-amber-200 rounded-2xl p-4 flex items-center justify-between shadow-sm shadow-amber-100">
               <div className="flex items-center">
                 <div className="bg-amber-100 p-2 rounded-xl mr-4">
                   <AlertCircle className="w-5 h-5 text-amber-600" />
                 </div>
                 <div>
                   <h4 className="font-semibold text-amber-900 text-sm">{doc.title}</h4>
                   <p className="text-xs text-amber-700">Vencimento: {doc.dueDate}</p>
                 </div>
               </div>
               <div className="flex gap-2">
                 <button className="px-4 py-2 text-xs font-bold rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-100 transition-colors flex items-center">
                    <Copy className="w-3 h-3 mr-1" /> Copiar Cód.
                 </button>
                 <button className="px-4 py-2 text-xs font-bold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors">
                    Sinalizar Pago
                 </button>
               </div>
            </div>
          ))}
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white p-6 flex flex-col justify-center items-center shadow-xl shadow-slate-200/50">
           <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Regularidade Fiscal</h3>
           {data.client.regularityStatus === "green" ? (
              <div className="text-center">
                <CheckCircle className="w-16 h-16 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)] mx-auto mb-3" />
                <span className="text-slate-800 font-bold">Tudo em dia</span>
              </div>
           ) : data.client.regularityStatus === "warning" ? (
             <div className="text-center">
                <AlertCircle className="w-16 h-16 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)] mx-auto mb-3" />
                <span className="text-slate-800 font-bold">Atenção</span>
              </div>
           ) : (
             <div className="text-center">
                <AlertCircle className="w-16 h-16 text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.6)] mx-auto mb-3" />
                <span className="text-slate-800 font-bold">Irregular</span>
              </div>
           )}
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white p-6 shadow-xl shadow-slate-200/50">
          <h3 className="font-bold text-slate-800 mb-6">Evolução do Faturamento Anual</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.billing} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white p-6 shadow-xl shadow-slate-200/50">
          <h3 className="font-bold text-slate-800 mb-6">Despesas & Folha</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.billing} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                <Tooltip cursor={{fill: '#f8fafc', opacity: 0.5}} contentStyle={{ borderRadius: '12px', border: 'none', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px', fontWeight: 'bold', color: '#94a3b8' }} />
                <Bar dataKey="expenses" name="Despesas" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="payroll" name="Folha" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
