import React, { useEffect, useState, useRef } from "react";
import { AlertCircle, CheckCircle, Copy, Bell, Upload, FileCheck } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";
import { format, parseISO, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

export function ClientDashboard() {
  const [data, setData] = useState<any>(null);
  const [selectedCompetence, setSelectedCompetence] = useState(format(subMonths(new Date(), 1), "MM/yyyy"));
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const user = JSON.parse(localStorage.getItem("clientUser") || sessionStorage.getItem("clientUser") || "{}");

  const loadData = () => {
    const token = localStorage.getItem("clientToken") || sessionStorage.getItem("clientToken");
    fetch("/api/client/dashboard", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(setData);
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleUploadBankStatement = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const token = localStorage.getItem("clientToken") || sessionStorage.getItem("clientToken");
    
    try {
      // In a real app we would upload the file to cloud storage (S3/GCS) 
      // For this prototype, we just register the action in the DB
      await fetch("/api/client/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: `Extrato Bancário (${selectedCompetence})`,
          category: "bank_statement",
          competence: selectedCompetence,
        }),
      });
      loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!data) return <div className="animate-pulse flex space-x-4"><div className="flex-1 space-y-4 py-1"><div className="h-4 bg-slate-200 rounded w-3/4"></div><div className="space-y-2"><div className="h-4 bg-slate-200 rounded"></div><div className="h-4 bg-slate-200 rounded w-5/6"></div></div></div></div>;

  // Filter pending documents by competence
  const pendingDocs = data.documents.filter((d: any) => d.competence === selectedCompetence && (d.status === "pending" || d.status === "new") && d.category !== "bank_statement");
  
  // Check if bank statement was uploaded for this competence
  const hasBankStatement = data.documents.some((d: any) => d.category === "bank_statement" && d.competence === selectedCompetence);
  
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <header className="h-16 flex items-center justify-between px-8 bg-white/40 backdrop-blur-md border border-white rounded-2xl shadow-sm -mx-4 dark:bg-slate-800/40 dark:border-slate-700">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Olá, {data.client.name}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Resumo da sua situação contábil.</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">Competência:</label>
          <select 
            value={selectedCompetence}
            onChange={e => setSelectedCompetence(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-800 dark:text-white"
          >
            <option value="06/2026">06/2026</option>
            <option value="05/2026">05/2026</option>
            <option value="04/2026">04/2026</option>
            <option value="03/2026">03/2026</option>
            <option value="02/2026">02/2026</option>
            <option value="01/2026">01/2026</option>
          </select>
        </div>
      </header>

      {/* Alertas e Regularidade */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 md:col-span-2 space-y-4">
          
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-white dark:border-slate-700 rounded-3xl p-6 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 flex flex-col justify-center">
            <h3 className="font-bold text-slate-800 dark:text-white mb-2">Extrato Bancário</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Envie seu extrato bancário (PDF ou OFX) referente à competência <strong>{selectedCompetence}</strong>.</p>
            
            {hasBankStatement ? (
              <div className="flex items-center text-virgula-green font-bold bg-virgula-green/10 p-3 rounded-xl border border-virgula-green/20">
                <FileCheck className="w-5 h-5 mr-2" /> Extrato processado para {selectedCompetence}
              </div>
            ) : (
              <div>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  className="hidden" 
                  accept=".pdf,.ofx" 
                  onChange={handleUploadBankStatement}
                />
                <button 
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto px-6 py-3 bg-slate-900 dark:bg-virgula-green text-white text-sm font-bold rounded-xl shadow-md hover:opacity-90 transition-opacity flex items-center justify-center disabled:opacity-50"
                >
                  <Upload className="w-4 h-4 mr-2" /> 
                  {isUploading ? "Enviando..." : `Fazer Upload do Extrato (${selectedCompetence})`}
                </button>
              </div>
            )}
          </div>

          {data.messages.filter((m:any) => !m.read).map((msg:any) => (
            <div key={msg.id} className="bg-blue-50/80 dark:bg-blue-900/20 backdrop-blur-md border border-blue-100 dark:border-blue-800/50 rounded-2xl p-4 flex items-start shadow-sm shadow-blue-50 dark:shadow-none">
              <Bell className="text-blue-500 w-5 h-5 mt-0.5 mr-3 shrink-0" />
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-300 text-sm">Aviso do contador</h4>
                <p className="text-blue-800 dark:text-blue-200 text-sm mt-1">{msg.content}</p>
                <span className="text-xs text-blue-400 mt-2 block">{format(parseISO(msg.createdAt), "dd MMM, HH:mm", { locale: ptBR })}</span>
              </div>
            </div>
          ))}
          
          {pendingDocs.length === 0 ? (
             <div className="bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 text-center shadow-sm">
                <CheckCircle className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Nenhum documento pendente para a competência {selectedCompetence}.</p>
             </div>
          ) : pendingDocs.map((doc:any) => (
            <div key={doc.id} className="bg-amber-50/80 dark:bg-amber-900/20 backdrop-blur-md border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4 flex items-center justify-between shadow-sm shadow-amber-100 dark:shadow-none">
               <div className="flex items-center">
                 <div className="bg-amber-100 dark:bg-amber-900/50 p-2 rounded-xl mr-4">
                   <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                 </div>
                 <div>
                   <h4 className="font-semibold text-amber-900 dark:text-amber-200 text-sm">{doc.title}</h4>
                   <p className="text-xs text-amber-700 dark:text-amber-400 whitespace-nowrap">Vencimento: {doc.dueDate || "N/A"}</p>
                 </div>
               </div>
               <div className="flex gap-2">
                 <button className="px-4 py-2 text-xs font-bold rounded-lg border border-amber-300 dark:border-amber-700/50 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors flex items-center">
                    <Copy className="w-3 h-3 mr-1" /> Copiar
                 </button>
                 <button className="px-4 py-2 text-xs font-bold rounded-lg bg-amber-600 dark:bg-amber-500 text-white hover:bg-amber-700 dark:hover:bg-amber-600 transition-colors">
                    Marcar Pago
                 </button>
               </div>
            </div>
          ))}
        </div>

        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl border border-white dark:border-slate-700 p-6 flex flex-col justify-center items-center shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50">
           <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Regularidade Fiscal</h3>
           {data.client.regularityStatus === "green" ? (
              <div className="text-center">
                <CheckCircle className="w-16 h-16 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)] mx-auto mb-3" />
                <span className="text-slate-800 dark:text-white font-bold">Tudo em dia</span>
              </div>
           ) : data.client.regularityStatus === "warning" ? (
             <div className="text-center">
                <AlertCircle className="w-16 h-16 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)] mx-auto mb-3" />
                <span className="text-slate-800 dark:text-white font-bold">Atenção</span>
              </div>
           ) : (
             <div className="text-center">
                <AlertCircle className="w-16 h-16 text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.6)] mx-auto mb-3" />
                <span className="text-slate-800 dark:text-white font-bold">Irregular</span>
              </div>
           )}
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl border border-white dark:border-slate-700 p-6 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50">
          <h3 className="font-bold text-slate-800 dark:text-white mb-6">Evolução do Faturamento Anual</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.billing} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.2} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', background: 'rgba(30,41,59,0.9)', color: 'white', backdropFilter: 'blur(8px)' }} />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl border border-white dark:border-slate-700 p-6 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50">
          <h3 className="font-bold text-slate-800 dark:text-white mb-6">Despesas & Folha</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.billing} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.2} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ borderRadius: '12px', border: 'none', background: 'rgba(30,41,59,0.9)', color: 'white', backdropFilter: 'blur(8px)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px', fontWeight: 'bold', color: '#94a3b8' }} />
                <Bar dataKey="expenses" name="Despesas" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="payroll" name="Folha" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
