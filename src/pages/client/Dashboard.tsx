import React, { useEffect, useState, useRef } from "react";
import { AlertCircle, CheckCircle, Copy, Bell, Upload, FileCheck, FileSpreadsheet, Edit3 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";
import { format, parse, subMonths, isBefore, isAfter, isEqual, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";

export function ClientDashboard() {
  const [data, setData] = useState<any>(null);
  const [selectedCompetence, setSelectedCompetence] = useState(format(subMonths(new Date(), 1), "MM/yyyy"));
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelFileRef = useRef<HTMLInputElement>(null);
  const user = JSON.parse(localStorage.getItem("clientUser") || sessionStorage.getItem("clientUser") || "{}");

  const [billingForm, setBillingForm] = useState({ servicesRevenue: 0, salesRevenue: 0, totalIncomes: 0, servicesTaken: 0 });
  const [showBillingForm, setShowBillingForm] = useState(false);

  const loadData = () => {
    const token = localStorage.getItem("clientToken") || sessionStorage.getItem("clientToken");
    fetch("/api/client/dashboard", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => {
         setData(d);
         const entry = d.billing.find((b: any) => b.month === selectedCompetence);
         if (entry) {
           setBillingForm({ servicesRevenue: entry.servicesRevenue, salesRevenue: entry.salesRevenue, totalIncomes: entry.totalIncomes, servicesTaken: entry.servicesTaken });
         } else {
           setBillingForm({ servicesRevenue: 0, salesRevenue: 0, totalIncomes: 0, servicesTaken: 0 });
         }
      });
  }

  useEffect(() => {
    if (data) {
       const entry = data.billing.find((b: any) => b.month === selectedCompetence);
       if (entry) {
         setBillingForm({ servicesRevenue: entry.servicesRevenue, salesRevenue: entry.salesRevenue, totalIncomes: entry.totalIncomes, servicesTaken: entry.servicesTaken });
       } else {
         setBillingForm({ servicesRevenue: 0, salesRevenue: 0, totalIncomes: 0, servicesTaken: 0 });
       }
    }
  }, [selectedCompetence]);

  useEffect(() => {
    loadData();
  }, []);

  const handleUploadBankStatement = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const token = localStorage.getItem("clientToken") || sessionStorage.getItem("clientToken");
    
    try {
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

  const saveBillingData = async (e?: React.FormEvent) => {
    if(e) e.preventDefault();
    const token = localStorage.getItem("clientToken") || sessionStorage.getItem("clientToken");
    try {
      await fetch("/api/client/update-billing", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ month: selectedCompetence, ...billingForm })
      });
      setShowBillingForm(false);
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      
      const parsedData = data.map((row: any) => ({
         month: row.Competencia || row.Mes || row.month,
         servicesRevenue: Number(row.FaturamentoServico || row.servicesRevenue || 0),
         salesRevenue: Number(row.FaturamentoVenda || row.salesRevenue || 0),
         totalIncomes: Number(row.TotalEntradas || row.totalIncomes || 0),
         servicesTaken: Number(row.ServicosTomados || row.servicesTaken || 0),
      })).filter(r => r.month);

      if (parsedData.length > 0) {
        const token = localStorage.getItem("clientToken") || sessionStorage.getItem("clientToken");
        await fetch("/api/client/bulk-billing", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ data: parsedData })
        });
        loadData();
      }
      if (excelFileRef.current) excelFileRef.current.value = "";
    };
    reader.readAsBinaryString(file);
  };

  if (!data) return <div className="animate-pulse flex space-x-4"><div className="flex-1 space-y-4 py-1"><div className="h-4 bg-slate-200 rounded w-3/4"></div><div className="space-y-2"><div className="h-4 bg-slate-200 rounded"></div><div className="h-4 bg-slate-200 rounded w-5/6"></div></div></div></div>;

  const pendingDocs = data.documents.filter((d: any) => d.competence === selectedCompetence && (d.status === "pending" || d.status === "new") && d.category !== "bank_statement");
  const hasBankStatement = data.documents.some((d: any) => d.category === "bank_statement" && d.competence === selectedCompetence);

  // Compute historic data for the charts (up to 12 months)
  // Parse selected competence
  const compDate = parse(selectedCompetence, "MM/yyyy", new Date());
  compDate.setDate(1); // Standardize on the first of the month
  
  // Create last 12 months array
  const last12Months = Array.from({length: 12}, (_, i) => format(subMonths(compDate, 11 - i), "MM/yyyy"));
  
  // Map billing data to this timeline
  const chartData = last12Months.map(m => {
     const found = data.billing.find((b:any) => b.month === m);
     return {
       month: m,
       FaturamentoServiço: found?.servicesRevenue || 0,
       FaturamentoVendas: found?.salesRevenue || 0,
       Tomados: found?.servicesTaken || 0,
       Entradas: found?.totalIncomes || 0
     };
  });

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
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-virgula-green"
          >
            {Array.from({length: 24}, (_, i) => {
               const d = format(subMonths(new Date(), i), "MM/yyyy");
               return <option key={d} value={d}>{d}</option>
            })}
          </select>
        </div>
      </header>

      {/* Alertas e Upload de Faturamento */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-1 md:col-span-2 space-y-4">
          
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-white dark:border-slate-700 rounded-3xl p-6 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 flex flex-col justify-center">
            <h3 className="font-bold text-slate-800 dark:text-white mb-2">Inserir Dados da Competência {selectedCompetence}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Envie seu extrato bancário ou informe seus valores de faturamento e serviços.</p>
            
            <div className="flex flex-wrap gap-3 mb-6">
               {hasBankStatement ? (
                  <div className="flex-1 min-w-[200px] flex justify-center items-center text-virgula-green font-bold bg-virgula-green/10 p-3 rounded-xl border border-virgula-green/20 text-sm">
                    <FileCheck className="w-5 h-5 mr-2" /> Extrato anexado
                  </div>
                ) : (
                  <div className="flex-1 min-w-[200px]">
                    <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.ofx" onChange={handleUploadBankStatement}/>
                    <button disabled={isUploading} onClick={() => fileInputRef.current?.click()} className="w-full px-4 py-3 bg-slate-900 dark:bg-slate-700 text-white text-sm font-bold rounded-xl shadow-md hover:bg-slate-800 transition-colors flex items-center justify-center disabled:opacity-50">
                      <Upload className="w-4 h-4 mr-2" /> {isUploading ? "Enviando..." : "Extrato Bancário"}
                    </button>
                  </div>
                )}
                
                <div className="flex-1 min-w-[200px]">
                   <input type="file" ref={excelFileRef} className="hidden" accept=".xlsx,.xls,.csv" onChange={handleExcelImport} />
                   <button onClick={() => excelFileRef.current?.click()} className="w-full px-4 py-3 bg-emerald-600 text-white text-sm font-bold rounded-xl shadow-md hover:bg-emerald-700 transition-colors flex items-center justify-center">
                     <FileSpreadsheet className="w-4 h-4 mr-2" /> Importar Excel (.xlsx)
                   </button>
                </div>
                
                <div className="flex-1 min-w-[200px]">
                   <button onClick={() => setShowBillingForm(!showBillingForm)} className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-center">
                     <Edit3 className="w-4 h-4 mr-2" /> Preencher Manual
                   </button>
                </div>
             </div>

             {showBillingForm && (
              <form onSubmit={saveBillingData} className="bg-slate-50 dark:bg-slate-900/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 mt-2 space-y-4 animate-in slide-in-from-top-2">
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Faturamento Serviços</label>
                      <input type="number" value={billingForm.servicesRevenue} onChange={e => setBillingForm({...billingForm, servicesRevenue: Number(e.target.value)})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Faturamento Vendas</label>
                      <input type="number" value={billingForm.salesRevenue} onChange={e => setBillingForm({...billingForm, salesRevenue: Number(e.target.value)})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Serviços Tomados</label>
                      <input type="number" value={billingForm.servicesTaken} onChange={e => setBillingForm({...billingForm, servicesTaken: Number(e.target.value)})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Total Entradas</label>
                      <input type="number" value={billingForm.totalIncomes} onChange={e => setBillingForm({...billingForm, totalIncomes: Number(e.target.value)})} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 dark:text-white" />
                    </div>
                 </div>
                 <button type="submit" className="w-full py-2 bg-virgula-green text-white font-bold rounded-lg shadow-sm text-sm hover:opacity-90">Salvar Faturamento</button>
              </form>
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
                    <Copy className="w-3 h-3 mr-1" /> Copiar Cód.
                 </button>
                 <button className="px-4 py-2 text-xs font-bold rounded-lg bg-amber-600 dark:bg-amber-500 text-white hover:bg-amber-700 dark:hover:bg-amber-600 transition-colors">
                    Marcar Pago
                 </button>
               </div>
            </div>
          ))}
        </div>

        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl border border-white dark:border-slate-700 p-6 flex flex-col justify-start items-stretch shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50">
           <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Situação Fiscal da Empresa</h3>
           {data.client.regularityStatus === "green" ? (
              <div className="text-center">
                <CheckCircle className="w-16 h-16 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)] mx-auto mb-3" />
                <span className="text-slate-800 dark:text-white font-bold">Situação perante à Receita: Regular 🟢</span>
              </div>
           ) : (
              <div className="space-y-3 w-full">
                 <div className="text-center py-2 border-b border-slate-100 dark:border-slate-700">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-2 animate-pulse" />
                    <span className="text-sm font-bold text-red-600 dark:text-red-400 block mt-2">Atenção: Pendências detectadas 🔴</span>
                 </div>
                 <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2 mt-2 text-left">
                    <p className="font-semibold text-slate-700 dark:text-slate-350">Detalhamento das pendências:</p>
                    {pendingDocs.length > 0 ? (
                       <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-300">
                          {pendingDocs.map((doc: any) => (
                             <li key={doc.id}>
                                {doc.title} {doc.dueDate && `(Vence em: ${doc.dueDate})`}
                             </li>
                          ))}
                       </ul>
                    ) : (
                       <p className="italic text-slate-500">Existem pendências burocráticas sob análise da Receita Federal. Contate o suporte do contador no mural ao lado para mais detalhes.</p>
                    )}
                 </div>
              </div>
            )}
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl border border-white dark:border-slate-700 p-6 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50">
          <h3 className="font-bold text-slate-800 dark:text-white mb-6">Faturamento Acumulado (12 Meses)</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorServ" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                     <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorVend" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                     <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.2} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', background: 'rgba(30,41,59,0.9)', color: 'white', backdropFilter: 'blur(8px)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px', fontWeight: 'bold', color: '#94a3b8' }} />
                <Area type="monotone" dataKey="FaturamentoServiço" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorServ)" />
                <Area type="monotone" dataKey="FaturamentoVendas" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorVend)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl border border-white dark:border-slate-700 p-6 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50">
          <h3 className="font-bold text-slate-800 dark:text-white mb-6">Entradas e Serviços Tomados</h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.2} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 'bold'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ borderRadius: '12px', border: 'none', background: 'rgba(30,41,59,0.9)', color: 'white', backdropFilter: 'blur(8px)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px', fontWeight: 'bold', color: '#94a3b8' }} />
                <Bar dataKey="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Tomados" name="Serviços Tomados" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
