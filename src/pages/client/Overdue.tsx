import React, { useState, useEffect } from "react";
import { format, isBefore, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, FileText, Download, CheckCircle, Clock } from "lucide-react";
import { PixScannerButton } from "../../components/PixScannerButton";

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
      
      // Filter documents uploaded by accountant (usually guias/impostos) that are not paid and past due date
      const overdue = data.documents.filter((doc: any) => {
        if (doc.status === "paid") return false;
        if (!doc.dueDate) return false;
        
        // Sometimes dueDate is stored as "YYYY-MM-DD", try to parse it
        // Or it could be other format. Assuming ISO or YYYY-MM-DD
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
          if (isNaN(dueDateObj.getTime())) return false; // invalid date
          
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-red-500" />
            Guias em Atraso
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Impostos e guias que já passaram da data de vencimento e não foram marcados como pagos.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={isRefreshing}
          className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50"
        >
          {isRefreshing ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

      {overdueDocs.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Tudo em dia!</h2>
          <p className="text-slate-500">Você não possui guias em atraso no momento.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {overdueDocs.map((doc: any) => (
            <div key={doc.id} className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/30 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
              
              <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center ml-2">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-white text-base">{doc.title}</h3>
                    <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                      <span className="flex items-center gap-1 font-medium text-red-600 dark:text-red-400">
                        <Clock className="w-4 h-4" />
                        Vencido em {
                          doc.dueDate.includes("/") ? doc.dueDate : 
                          doc.dueDate.includes("-") ? `${doc.dueDate.split("T")[0].split("-")[2]}/${doc.dueDate.split("T")[0].split("-")[1]}/${doc.dueDate.split("T")[0].split("-")[0]}` : 
                          format(parseISO(doc.dueDate), "dd/MM/yyyy")
                        }
                      </span>
                      {doc.competence && (
                        <span>• Ref: {doc.competence}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleMarkAsPaid(doc.id)}
                    className="flex-1 md:flex-none px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Marcar Pago
                  </button>
                  
                  {doc.fileUrl && (
                    <a
                      href={doc.fileUrl}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 md:flex-none px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Baixar
                    </a>
                  )}
                  
                  {doc.fileUrl && doc.fileUrl.endsWith(".pdf") && (
                    <div className="flex-1 md:flex-none">
                       <PixScannerButton docId={doc.id} fileUrl={doc.fileUrl} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
