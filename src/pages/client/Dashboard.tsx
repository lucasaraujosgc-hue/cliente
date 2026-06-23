import React, { useEffect, useState, useRef } from "react";
import { 
  AlertCircle, 
  CheckCircle, 
  Copy, 
  Bell, 
  Upload, 
  FileCheck, 
  FileSpreadsheet, 
  Edit3, 
  Calendar, 
  Clock, 
  Smartphone, 
  X, 
  TrendingUp, 
  Activity, 
  Download, 
  RefreshCw,
  Check,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";
import { format, parse, subMonths, isBefore, isAfter, isEqual, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";

export function ClientDashboard() {
  const [data, setData] = useState<any>(null);
  const [selectedCompetence, setSelectedCompetence] = useState(format(subMonths(new Date(), 1), "MM/yyyy"));
  const [isUploading, setIsUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showPwaBanner, setShowPwaBanner] = useState(() => {
    return localStorage.getItem("dismissPwaBanner_v2") !== "true";
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelFileRef = useRef<HTMLInputElement>(null);
  const user = JSON.parse(localStorage.getItem("clientUser") || sessionStorage.getItem("clientUser") || "{}");

  const [billingForm, setBillingForm] = useState({ servicesRevenue: 0, salesRevenue: 0, totalIncomes: 0, servicesTaken: 0 });
  const [showBillingForm, setShowBillingForm] = useState(false);

  const loadData = async () => {
    setIsRefreshing(true);
    const token = localStorage.getItem("clientToken") || sessionStorage.getItem("clientToken");
    try {
      const response = await fetch("/api/client/dashboard", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const d = await response.json();
      setData(d);
      const entry = d.billing.find((b: any) => b.month === selectedCompetence);
      if (entry) {
        setBillingForm({ 
          servicesRevenue: entry.servicesRevenue, 
          salesRevenue: entry.salesRevenue, 
          totalIncomes: entry.totalIncomes, 
          servicesTaken: entry.servicesTaken 
        });
      } else {
        setBillingForm({ servicesRevenue: 0, salesRevenue: 0, totalIncomes: 0, servicesTaken: 0 });
      }
    } catch (e) {
      console.error("Error loading dashboard data", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (data) {
      const entry = data.billing.find((b: any) => b.month === selectedCompetence);
      if (entry) {
        setBillingForm({ 
          servicesRevenue: entry.servicesRevenue, 
          salesRevenue: entry.salesRevenue, 
          totalIncomes: entry.totalIncomes, 
          servicesTaken: entry.servicesTaken 
        });
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
      const formData = new FormData();
      formData.append("title", `Extrato Bancário (${selectedCompetence})`);
      formData.append("category", "bank_statement");
      formData.append("competence", selectedCompetence);
      formData.append("file", file);

      await fetch("/api/client/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
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
    if (e) e.preventDefault();
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

  const handleMarkAsPaid = async (docId: string) => {
    const token = localStorage.getItem("clientToken") || sessionStorage.getItem("clientToken");
    try {
      const res = await fetch(`/api/client/mark-doc/${docId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: "paid" })
      });
      if (res.ok) {
        loadData();
      }
    } catch (err) {
      console.error("Error setting doc as paid", err);
    }
  };

  const handleCopyCode = (docId: string, textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(docId);
    setTimeout(() => {
      setCopiedId(null);
    }, 2500);
  };

  const dismissPwaBanner = () => {
    localStorage.setItem("dismissPwaBanner_v2", "true");
    setShowPwaBanner(false);
  };

  // Compute competences list once
  const availableCompetences = Array.from({ length: 24 }, (_, i) => format(subMonths(new Date(), i), "MM/yyyy"));

  const handlePrevCompetence = () => {
    const idx = availableCompetences.indexOf(selectedCompetence);
    if (idx < availableCompetences.length - 1) {
      setSelectedCompetence(availableCompetences[idx + 1]);
    }
  };

  const handleNextCompetence = () => {
    const idx = availableCompetences.indexOf(selectedCompetence);
    if (idx > 0) {
      setSelectedCompetence(availableCompetences[idx - 1]);
    }
  };

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <RefreshCw className="w-8 h-8 text-virgula-green animate-spin" />
        <p className="text-slate-500 text-sm font-medium animate-pulse">Carregando painel contábil...</p>
      </div>
    );
  }

  // Parse Brazilian Date String (DD/MM/YYYY) to standard Date object
  const parseDueDateString = (dateStr: string) => {
    if (!dateStr) return null;
    try {
      if (dateStr.includes("/")) {
        const [day, month, year] = dateStr.split("/").map(Number);
        return new Date(year, month - 1, day);
      }
      return new Date(dateStr);
    } catch (e) {
      return null;
    }
  };

  // Check the status of each expiration based on standard system date June 22, 2026
  const getDocDueStatus = (doc: any) => {
    if (doc.status === "paid") {
      return { label: "Pago", colorClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300", badgeColor: "bg-emerald-500", priority: 3 };
    }
    
    if (!doc.dueDate) {
      return { label: "Sem Vencimento", colorClass: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-350", badgeColor: "bg-slate-400", priority: 4 };
    }

    const todayDate = new Date(2026, 5, 22); // June 22, 2026
    const parsedDue = parseDueDateString(doc.dueDate);

    if (!parsedDue) {
      return { label: "Pendente", colorClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400", badgeColor: "bg-amber-500", priority: 2 };
    }

    // Reset times
    todayDate.setHours(0,0,0,0);
    parsedDue.setHours(0,0,0,0);

    const diffDays = differenceInDays(parsedDue, todayDate);

    if (diffDays < 0) {
      return { label: `Atrasado [${Math.abs(diffDays)}d] 🔴`, colorClass: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/50 blink shadow-sm", badgeColor: "bg-rose-500", priority: 0, isOverdue: true };
    } else if (diffDays <= 4) {
      return { label: `Vence em breve [${diffDays}d] ⚠️`, colorClass: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-700/50 animate-pulse", badgeColor: "bg-amber-500", priority: 1, isSoon: true };
    } else {
      return { label: `Vence em ${doc.dueDate}`, colorClass: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400", badgeColor: "bg-blue-500", priority: 2 };
    }
  };

  // Find all documents for the selected competence or with important upcoming maturities
  const allCurrentDocs = data.documents.filter((d: any) => 
    d.competence === selectedCompetence && d.category !== "bank_statement"
  );

  // Filter pending ones explicitly
  const pendingDocs = allCurrentDocs.filter((d: any) => d.status !== "paid");

  // Sort documents: Overdue first, followed by soon-to-expire, standard pending, and paid
  const sortedExpirations = [...allCurrentDocs].sort((a: any, b: any) => {
    const statusA = getDocDueStatus(a);
    const statusB = getDocDueStatus(b);
    return statusA.priority - statusB.priority;
  });

  const monthsTotalBilling = billingForm.servicesRevenue + billingForm.salesRevenue;
  const hasBankStatement = data.documents.some((d: any) => d.category === "bank_statement" && d.competence === selectedCompetence);

  // Compile historic dataset for Recharts
  const compDate = parse(selectedCompetence, "MM/yyyy", new Date());
  compDate.setDate(1);
  const last12Months = Array.from({ length: 12 }, (_, i) => format(subMonths(compDate, 11 - i), "MM/yyyy"));
  const chartData = last12Months.map(m => {
    const found = data.billing.find((b: any) => b.month === m);
    return {
      month: m,
      FaturamentoServiço: found?.servicesRevenue || 0,
      FaturamentoVendas: found?.salesRevenue || 0,
      Tomados: found?.servicesTaken || 0,
      Entradas: found?.totalIncomes || 0
    };
  });

  return (
    <div className="space-y-6 pb-24 px-4 sm:px-6 animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-7xl mx-auto">
      
      {/* 📱 PWA SMART HELPER BANNER */}
      {showPwaBanner && (
        <div className="relative bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-5 rounded-3xl shadow-lg border border-emerald-500/20 flex flex-col sm:flex-row items-center sm:justify-between gap-4 overflow-hidden transform duration-250 hover:shadow-xl mt-3">
          <div className="absolute top-0 right-0 p-16 bg-white/5 rounded-full translate-x-12 -translate-y-12 pointer-events-none"></div>
          <div className="flex items-center gap-4 z-10">
            <div className="p-3 bg-white/15 backdrop-blur-md rounded-2xl text-emerald-100 animate-bounce shrink-0">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm sm:text-base tracking-tight">Dica de Aplicativo PWA 📱</h4>
              <p className="text-emerald-100 text-xs mt-1 leading-relaxed max-w-xl">
                Acesse como aplicativo nativo! Toque em <strong className="text-white hover:underline cursor-pointer">"Compartilhar"</strong> em seu navegador móvel e selecione <strong className="text-white">"Adicionar à Tela de Início"</strong> para enviar extratos e gerenciar vencimentos instantaneamente de seu celular.
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0 z-10 self-end sm:self-center">
            <button 
              onClick={dismissPwaBanner} 
              className="p-2 bg-black/10 hover:bg-black/25 rounded-xl text-white transition-all"
              title="Dispensar sugestão"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* HEADER SECTION */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-500/20">
              Painel PWA Ativo
            </span>
            {isRefreshing && (
              <span className="text-slate-400 text-xs flex items-center animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin mr-1 text-slate-500" /> Sincronizando...
              </span>
            )}
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mt-1">
            Olá, {data.client.name}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Gerenciamento contábil e obrigações fiscais em tempo real.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden h-10 w-[200px]">
            <button 
              onClick={handlePrevCompetence}
              disabled={availableCompetences.indexOf(selectedCompetence) === availableCompetences.length - 1}
              className="px-3 h-full flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
            >
               <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 flex flex-col items-center justify-center">
               <span className="text-[10px] font-semibold text-slate-400 leading-none mb-0.5">Competência</span>
               <span className="text-sm font-black text-slate-800 dark:text-white leading-none">{selectedCompetence}</span>
            </div>
            <button 
              onClick={handleNextCompetence}
              disabled={availableCompetences.indexOf(selectedCompetence) === 0}
              className="px-3 h-full flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
            >
               <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button 
            disabled={isRefreshing}
            onClick={loadData}
            className="p-2.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm active:scale-95 transition-all text-xs flex items-center justify-center h-10 w-10 disabled:opacity-50"
            title="Atualizar dados"
            id="refresh-dashboard-btn"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

          {/* SATELLITE COMMUNICATIONS FROM ACCOUNTANT */}
          {data.messages && data.messages.filter((m: any) => !m.read).map((msg: any) => (
            <div key={msg.id} className="bg-indigo-50/70 dark:bg-slate-800/40 backdrop-blur-md border border-indigo-100/40 dark:border-slate-700/60 rounded-3xl p-4 flex items-start shadow-xs">
              <Bell className="text-indigo-500 dark:text-indigo-400 w-5 h-5 mt-0.5 mr-3 shrink-0" />
              <div>
                <h4 className="font-bold text-indigo-950 dark:text-indigo-300 text-sm">Mensagem do Contador</h4>
                <p className="text-slate-600 dark:text-slate-300 text-xs mt-1 leading-relaxed">{msg.content}</p>
                <span className="text-[10px] text-slate-400 mt-2 block font-mono">{format(parseISO(msg.createdAt), "dd MMM, HH:mm", { locale: ptBR })}</span>
              </div>
            </div>
          ))}


          {/* 🚨 DEDICATED HIGH-VISIBILITY DUE DATE SECTION (VENCIMENTOS) */}
          <div className="bg-white/80 dark:bg-slate-800/90 backdrop-blur-lg rounded-3xl border border-slate-150/80 dark:border-slate-800/80 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700/50 gap-2 mb-4">
              <div>
                <h3 className="font-black text-slate-800 dark:text-white text-base flex items-center gap-1.5">
                  <Clock className="w-5 h-5 text-amber-500" />
                  Próximos Vencimentos de Guias e Impostos
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Acompanhe e pague as guias enviadas pelo escritório. Data de referência: 22/06/2026.
                </p>
              </div>
              <span className="self-start sm:self-center px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-350 text-[10px] font-bold rounded-lg uppercase tracking-wide">
                Competência: {selectedCompetence}
              </span>
            </div>

            {sortedExpirations.length === 0 ? (
              <div className="py-12 text-center rounded-2xl bg-slate-50/50 dark:bg-slate-900/10 border border-slate-100 dark:border-slate-800/50">
                <CheckCircle className="w-10 h-10 text-emerald-400 dark:text-emerald-500/30 mx-auto mb-2" />
                <h4 className="font-bold text-slate-800 dark:text-slate-300 text-sm">Limpo e Seguro!</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                  Nenhum documento contábil emitido ou com vencimento cadastrado para {selectedCompetence}.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedExpirations.map((doc: any) => {
                  const dueInfo = getDocDueStatus(doc);
                  const isHighlighted = dueInfo.isOverdue || dueInfo.isSoon;

                  return (
                    <div 
                      key={doc.id} 
                      className={`relative overflow-hidden p-4 rounded-2xl border transition-all ${
                        isHighlighted 
                          ? "bg-gradient-to-r from-red-50/50 to-amber-50/20 shadow-xs border-amber-200 dark:from-rose-950/15 dark:to-amber-950/5 dark:border-rose-900/40"
                          : doc.status === "paid"
                            ? "bg-white/40 dark:bg-slate-900/10 border-slate-100 dark:border-slate-800 opacity-75"
                            : "bg-white dark:bg-slate-900/30 border-slate-200 hover:border-slate-300 dark:border-slate-805 dark:hover:border-slate-700"
                      }`}
                    >
                      {/* Visual neon priority pill at the side */}
                      {isHighlighted && (
                        <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${dueInfo.isOverdue ? 'bg-rose-500' : 'bg-amber-500'}`} />
                      )}

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                        <div className="flex items-start sm:items-center gap-3">
                          <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 sm:mt-0 ${
                            doc.status === "paid" 
                              ? "bg-emerald-500/10 text-emerald-500" 
                              : dueInfo.isOverdue 
                                ? "bg-rose-500/10 text-rose-500 dark:bg-rose-500/20" 
                                : "bg-amber-500/10 text-amber-500 dark:bg-amber-500/20"
                          }`}>
                            {doc.status === "paid" ? (
                              <Check className="w-5 h-5 text-emerald-500" />
                            ) : (
                              <AlertCircle className={`w-5 h-5 ${dueInfo.isOverdue ? 'animate-pulse' : ''}`} />
                            )}
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                                {doc.title}
                              </h4>
                              <span className={`px-2 py-0.5 text-[9px] font-extrabold uppercase rounded-full ${dueInfo.colorClass}`}>
                                {dueInfo.label}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-slate-400" /> Vencimento: <strong className="text-slate-700 dark:text-slate-300 font-extrabold">{doc.dueDate || "N/D"}</strong>
                              </span>
                              <span>•</span>
                              <span className="capitalize font-medium">Pasta: {doc.category === 'taxes' ? 'Impostos' : doc.category === 'payroll' ? 'Folha' : 'Geral'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Interactive tactile buttons */}
                        <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                          {doc.fileUrl && (
                            <a 
                              href={doc.fileUrl} 
                              target="_blank" 
                              referrerPolicy="no-referrer"
                              rel="noreferrer" 
                              className="h-10 px-3 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-xs font-bold rounded-xl text-slate-700 dark:text-slate-300 transition-colors"
                              title="Visualizar documento"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          )}

                          {doc.pixCode && (
                            <button 
                              onClick={() => handleCopyCode(doc.id, doc.pixCode)}
                              className="h-10 px-3 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-100 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-xl transition-all flex items-center justify-center min-w-[100px]"
                            >
                              {copiedId === doc.id ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 animate-pulse">
                                  <Check className="w-3.5 h-3.5" /> Copiado!
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 font-bold">
                                  <Copy className="w-3 h-3 text-indigo-400" /> Copiar qrcode pix
                                </span>
                              )}
                            </button>
                          )}


                          {doc.status !== "paid" && (
                            <button 
                              onClick={() => handleMarkAsPaid(doc.id)}
                              className="h-10 px-3 bg-slate-900 border border-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:border-emerald-500 dark:text-white dark:hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-xs transition-transform active:scale-95"
                            >
                              Marcar Pago
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>


      {/* ⚡ TACTILE QUICK KPI STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Stat 1: Faturamento do Mês */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl shadow-sm hover:shadow-md transition-shadow flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Faturamento Declarado ({selectedCompetence})</p>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
              {monthsTotalBilling.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </h3>
            <p className="text-[10px] text-slate-500 flex items-center">
              <TrendingUp className="w-3 h-3 text-emerald-500 mr-1" />
              Preenchido pela contabilidade & manual
            </p>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 rounded-2xl">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        {/* Stat 2: Documentos e Guias Pendentes */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl shadow-sm hover:shadow-md transition-shadow flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Guias de Impostos / Salários ({selectedCompetence})</p>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              {pendingDocs.length} {pendingDocs.length === 1 ? 'pendência' : 'pendências'}
            </h3>
            <p className="text-[10px] text-slate-500">
              {pendingDocs.length === 0 ? "🎉 Tudo pago e em dia!" : "⚠️ Requer atenção no vencimento"}
            </p>
          </div>
          <div className={`p-3 rounded-2xl ${pendingDocs.length > 0 ? "bg-amber-500/10 text-amber-500 dark:text-amber-400" : "bg-slate-100 dark:bg-slate-700 text-slate-400"}`}>
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Stat 3: Situação Fiscal */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl shadow-sm hover:shadow-md transition-shadow flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">SITUAÇÃO PERANTE À RECEITA</p>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
              {data.client.regularityStatus === "green" ? (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">Regular 🟢</span>
              ) : (
                <span className="text-red-500 dark:text-red-400 flex items-center gap-1">Restrições 🔴</span>
              )}
            </h3>
            <p className="text-[10px] text-slate-500">Cadastro de CNPJ e regularidade</p>
          </div>
          <div className={`p-3 rounded-2xl ${data.client.regularityStatus === "green" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* SECURITY / PASSWORD RESET NOTIFICATION BOX */}
      <div className="bg-gradient-to-r from-slate-50 to-indigo-50 dark:from-slate-800/30 dark:to-slate-800/10 border border-slate-200/50 dark:border-slate-700/50 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start sm:items-center">
          <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl mr-3 shrink-0">
            <Edit3 className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Configuração de Acesso</h4>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 leading-relaxed">
              O login e a senha inicial do portal do cliente cadastrados são o seu CNPJ. Altere de forma segura clicando ao lado.
            </p>
          </div>
        </div>
        <button 
          onClick={() => window.dispatchEvent(new CustomEvent("open-password-change-modal"))}
          className="px-4 py-2.5 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:text-white dark:hover:bg-emerald-600 text-white shadow-sm transition-transform active:scale-95 flex items-center justify-center shrink-0 self-start sm:self-center"
        >
          Alterar Senha de Acesso
        </button>
      </div>

      {/* MAIN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* COLUMN 1 & 2 */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* UPLOAD & DATA ENTRY AREA */}
          <div className="bg-white/85 dark:bg-slate-800/95 backdrop-blur-md border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-center">
            <h3 className="font-bold text-slate-800 dark:text-white mb-1">Inserir Dados da Competência {selectedCompetence}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Selecione o extrato bancário do seu negócio. Apenas formato PDF ou OFX.</p>
            
            <div className="flex flex-col sm:flex-row gap-3">
               {hasBankStatement ? (
                  <div className="flex-1 min-h-[44px] flex justify-center items-center text-emerald-600 font-bold bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20 text-sm">
                    <FileCheck className="w-5 h-5 mr-2 text-emerald-500" /> Extrato Bancário Anexado
                  </div>
                ) : (
                  <div className="flex-1">
                    <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.ofx" onChange={handleUploadBankStatement}/>
                    <button 
                      disabled={isUploading} 
                      onClick={() => fileInputRef.current?.click()} 
                      className="w-full min-h-[44px] px-4 py-3 bg-slate-900 dark:bg-slate-700 text-white text-sm font-bold rounded-2xl shadow-sm hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors flex items-center justify-center disabled:opacity-50"
                    >
                      <Upload className="w-4 h-4 mr-2" /> {isUploading ? "Enviando extrato..." : "Upload Extrato Bancário (PDF/OFX)"}
                    </button>
                  </div>
                )}
             </div>
          </div>


        </div>

        {/* COLUMN 3 */}
        <div className="space-y-6">
          
          {/* RECEITA FEDERAL STATUS */}
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl border border-slate-100 dark:border-slate-700 p-6 shadow-sm">
            <h3 className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Situação Fiscal da Empresa</h3>
            {data.client.regularityStatus === "green" ? (
               <div className="text-center p-4">
                 <CheckCircle className="w-16 h-16 text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.5)] mx-auto mb-4" />
                 <h4 className="text-slate-800 dark:text-white font-extrabold text-sm">Situação perante à Receita: Regular 🟢</h4>
                 <p className="text-[11px] text-slate-400 mt-2">Sem pendências registradas com o CNPJ no banco de dados sincronizado.</p>
               </div>
            ) : (
               <div className="space-y-3 w-full">
                  <div className="text-center py-2 border-b border-slate-100 dark:border-slate-700">
                     <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-2 animate-pulse" />
                     <span className="text-sm font-extrabold text-red-600 dark:text-red-400 block mt-2">Atenção: Pendências detectadas 🔴</span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2 mt-2 text-left">
                     <p className="font-semibold text-slate-700 dark:text-slate-300">Detalhamento das pendências:</p>
                     {pendingDocs.length > 0 ? (
                        <ul className="list-disc pl-4 space-y-1.5 text-slate-600 dark:text-slate-350">
                           {pendingDocs.map((doc: any) => (
                              <li key={doc.id}>
                                 <span className="font-medium text-slate-800 dark:text-slate-200">{doc.title}</span> {doc.dueDate && `(Vence em: ${doc.dueDate})`}
                              </li>
                           ))}
                        </ul>
                     ) : (
                        <p className="italic text-slate-500 dark:text-slate-400">Existem pendências burocráticas sob análise da Receita Federal. Contate o suporte do contador no mural para mais detalhes.</p>
                     )}
                  </div>
               </div>
             )}
          </div>

          {/* PLANTÃO CONTÁBIL */}
          <div className="bg-slate-900 text-white rounded-3xl p-6 relative overflow-hidden shadow-md">
            <div className="absolute top-0 right-0 p-12 bg-white/5 rounded-full translate-x-8 -translate-y-8 pointer-events-none"></div>
            <h4 className="font-extrabold text-sm tracking-tight mb-2">Suporte e Plantão Contábil 📞</h4>
            <p className="text-slate-300 text-xs leading-relaxed mb-4">
              Dúvidas na declaração do faturamento ou na conciliação bancária do seu extrato? Fale direto em nosso chat ou use o Cofre Digital.
            </p>
            <button 
              onClick={() => alert("Suporte técnico acionado! Nosso plantonista entrará em contato em breve.")}
              className="w-full text-center py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs rounded-xl transition-all"
            >
              Iniciar Chat de Plantão
            </button>
          </div>

        </div>
      </div>

      {/* 📊 ACCUMULATED HISTORIC GRAPH AREA SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-800">
        
        {/* Graph 1 */}
        <div className="bg-white dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
          <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-4">Faturamento Declarado (Histórico 12 Meses)</h3>
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorServNew" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                     <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorVendNew" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                     <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.15} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'medium' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', background: 'rgba(30,41,59,0.95)', color: 'white', backdropFilter: 'blur(8px)', fontSize: '12px' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px', color: '#94a3b8' }} />
                <Area type="monotone" name="Serviços" dataKey="FaturamentoServiço" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorServNew)" />
                <Area type="monotone" name="Mercadorias" dataKey="FaturamentoVendas" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorVendNew)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graph 2 */}
        <div className="bg-white dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
          <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-4">Total de Entradas vs Serviços Tomados</h3>
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.15} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'medium' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ borderRadius: '12px', border: 'none', background: 'rgba(30,41,59,0.95)', color: 'white', backdropFilter: 'blur(8px)', fontSize: '12px' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px', color: '#94a3b8' }} />
                <Bar dataKey="Entradas" name="Entradas Totais" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Tomados" name="Serviços Tomados" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
}
