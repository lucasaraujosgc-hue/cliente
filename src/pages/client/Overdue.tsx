import React, { useState, useEffect } from "react";
import { format, isBefore, parseISO, startOfDay, differenceInDays } from "date-fns";
import { AlertCircle, FileText, Download, CheckCircle, Clock, RotateCw, Calendar } from "lucide-react";
import { PixScannerButton } from "../../components/PixScannerButton";
import { GuiaAtualizarButton } from "../../components/GuiaAtualizarButton";

export function ClientOverdue() {
  const [loading, setLoading] = useState(true);
  const [overdueDocs, setOverdueDocs] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = async () => {
    setIsRefreshing(true);
    const token = localStorage.getItem("clientToken") || sessionStorage.getItem("clientToken");
    try {
      const response = await fetch("/api/client/dashboard", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      
      const today = startOfDay(new Date());
      
      // Filtra documentos enviados pelo contador que estão pendentes e com prazo expirado
      const overdue = data.documents.filter((doc: any) => {
        if (doc.status === "paid") return false;
        if (!doc.dueDate) return false;
        
        try {
          let dueDateObj;
          if (doc.dueDate.includes("/")) {
            const [day, month, year] = doc.dueDate.split("/").map(Number);
            dueDateObj = new Date(year, month - 1, day);
          } else if (doc.dueDate.includes("-")) {
            const parts = doc.dueDate.split("T")[0].split("-");
            dueDateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          } else {
            dueDateObj = parseISO(doc.dueDate);
          }
          if (isNaN(dueDateObj.getTime())) return false;
          
          return isBefore(startOfDay(dueDateObj), startOfDay(today));
        } catch (e) {
          return false;
        }
      }).sort((a: any, b: any) => {
        const parseDate = (d: string) => {
          if (!d) return 0;
          if (d.includes("/")) {
            const [day, month, year] = d.split("/").map(Number);
            return new Date(year, month - 1, day).getTime();
          } else if (d.includes("-")) {
            const parts = d.split("T")[0].split("-");
            return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
          }
          return parseISO(d).getTime();
        };
        return parseDate(a.dueDate) - parseDate(b.dueDate);
      });
      
      setOverdueDocs(overdue);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const getAuthenticatedFileUrl = (url: string | null) => {
    if (!url) return undefined;
    if (url.startsWith('/api/')) {
      const token = localStorage.getItem('clientToken') || sessionStorage.getItem('clientToken');
      return `${url}?token=${token}`;
    }
    return url;
  };

  const getDaysOverdue = (dueDateStr: string) => {
    try {
      let due;
      if (dueDateStr.includes("/")) {
        const [day, month, year] = dueDateStr.split("/").map(Number);
        due = new Date(year, month - 1, day);
      } else if (dueDateStr.includes("-")) {
        const parts = dueDateStr.split("T")[0].split("-");
        due = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      } else {
        due = parseISO(dueDateStr);
      }
      const today = startOfDay(new Date());
      due = startOfDay(due);
      return Math.abs(differenceInDays(due, today));
    } catch {
      return 0;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-96 space-y-4">
        <RotateCw className="w-8 h-8 text-indigo-600 animate-spin" />
        <span className="text-sm text-slate-500 font-medium animate-pulse">Buscando guias em atraso...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto px-4 sm:px-6 pb-16 animate-in fade-in slide-in-from-bottom-3 duration-550">
      
      {/* HEADER CARD PREMIUM */}
      <div className="relative overflow-hidden bg-gradient-to-r from-rose-900/95 via-red-950/95 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-lg border border-red-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="absolute top-0 right-0 p-24 bg-white/5 rounded-full translate-x-16 -translate-y-16 pointer-events-none"></div>
        <div className="z-10 space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-350 rounded-full border border-rose-500/35 animate-pulse">
              Ação Requerida
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5">
            <AlertCircle className="w-7 h-7 text-rose-400 shrink-0" />
            Guias em Atraso
          </h1>
          <p className="text-xs sm:text-sm text-rose-200 max-w-xl leading-relaxed">
            Evite multas acumuladas. Recalcule o valor dos seus impostos vencidos de forma automática utilizando a integração oficial do <strong className="text-white">Integra Contador</strong>.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={isRefreshing}
          className="z-10 self-start sm:self-center px-4 py-2.5 bg-white/10 hover:bg-white/20 active:scale-95 border border-white/10 hover:border-white/20 text-white rounded-xl text-xs font-black transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          {isRefreshing ? "Sincronizando..." : "Sincronizar"}
        </button>
      </div>

      {overdueDocs.length === 0 ? (
        /* CARD TUDO EM DIA */
        <div className="bg-white/70 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-16 text-center shadow-sm max-w-2xl mx-auto animate-in zoom-in-98 duration-305">
          <div className="w-20 h-20 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20 shadow-inner">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Tudo em Dia! 🎉</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
            Parabéns, você não possui nenhuma guia ou imposto pendente em atraso. Sua empresa está regularizada.
          </p>
        </div>
      ) : (
        /* GRID DE GUIAS EM ATRASO */
        <div className="grid gap-5">
          {overdueDocs.map((doc: any) => {
            const daysOverdue = getDaysOverdue(doc.dueDate);
            return (
              <div 
                key={doc.id} 
                className="group relative bg-white dark:bg-slate-900 border border-slate-200/75 hover:border-rose-300/60 dark:border-slate-800 dark:hover:border-rose-900/45 rounded-3xl p-5 sm:p-6 shadow-xs hover:shadow-md transition-all duration-305 flex flex-col md:flex-row md:items-center justify-between gap-5 overflow-hidden"
              >
                {/* Linha brilhante indicadora de alta prioridade na borda esquerda */}
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-rose-600 group-hover:bg-rose-500 transition-colors" />

                <div className="flex items-start gap-4 ml-1">
                  {/* Ícone de Documento Estilizado */}
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-100 dark:border-rose-900/30">
                    <FileText className="w-6 h-6" />
                  </div>
                  
                  <div className="space-y-1.5">
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-base leading-snug group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                      {doc.title}
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                      <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-extrabold bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20 animate-pulse">
                        <Clock className="w-3.5 h-3.5" />
                        Atrasado faz {daysOverdue} {daysOverdue === 1 ? "dia" : "dias"}
                      </span>
                      {doc.competence && (
                        <span className="flex items-center gap-1 font-semibold text-slate-400 dark:text-slate-500">
                          <Calendar className="w-3.5 h-3.5" />
                          Competência: {doc.competence}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Toolbar de Ações Integrada */}
                <div className="flex flex-col gap-3.5 w-full md:w-[280px] shrink-0">
                  
                  <div className="flex items-center gap-2 w-full">
                    {/* Botão de Download */}
                    {doc.fileUrl && (
                      <a
                        href={getAuthenticatedFileUrl(doc.fileUrl)}
                        download
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 h-9 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Baixar
                      </a>
                    )}
                    
                    {/* Escaneador PIX */}
                    {doc.fileUrl && doc.fileUrl.toLowerCase().endsWith(".pdf") && (
                      <div className="flex-1">
                         <PixScannerButton docId={doc.id} fileUrl={getAuthenticatedFileUrl(doc.fileUrl) || ""} />
                      </div>
                    )}
                  </div>

                  {/* Componente Integrado de Recálculo do Integra Contador */}
                  {(doc.category === "DCTFWEB" || doc.category === "SIMPLES_NACIONAL" || doc.category === "taxes" || doc.title?.toUpperCase().includes("DCTFWEB") || doc.title?.toUpperCase().includes("SIMPLES")) && (
                    <div className="w-full">
                      <GuiaAtualizarButton 
                        clienteId={doc.clientId}
                        guia={{
                          id: doc.id,
                          tipoGuia: (doc.category === "DCTFWEB" || doc.title?.toUpperCase().includes("DCTFWEB")) ? "DCTFWEB_INSS" : "DAS_SIMPLES",
                          competencia: doc.competence || "01/2026",
                          status: doc.status
                        }}
                        isOverdue={true}
                        onAtualizado={() => loadData()}
                      />
                    </div>
                  )}

                  {/* Marcar como Pago */}
                  <button
                    onClick={() => handleMarkAsPaid(doc.id)}
                    className="h-9 w-full bg-emerald-500 hover:bg-emerald-600 hover:shadow-md hover:shadow-emerald-100 dark:hover:shadow-none text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Marcar como Pago
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
