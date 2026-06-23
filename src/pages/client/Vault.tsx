import { useState, useEffect, FormEvent } from "react";
import { Folder, Receipt, FileIcon, Eye, Download, UploadCloud, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export function ClientVault() {
  const [docs, setDocs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("taxes");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadDocs = () => {
    fetch("/api/client/dashboard", {
      headers: { Authorization: `Bearer ${localStorage.getItem("clientToken") || sessionStorage.getItem("clientToken")}` }
    })
      .then(r => r.json())
      .then(data => setDocs(data.documents || []))
      .catch(e => console.error("Error loading vault docs", e));
  };

  useEffect(() => loadDocs(), []);

  const handleUpload = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    
    await fetch("/api/client/upload", {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${localStorage.getItem("clientToken") || sessionStorage.getItem("clientToken")}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ title, category: "upload" })
    });
    
    (e.target as HTMLFormElement).reset();
    loadDocs();
    alert("Enviado com sucesso para a contabilidade!");
  };

  const tabs = [
    { id: "taxes", label: "Guias de Impostos", icon: Receipt },
    { id: "payroll", label: "Folha/RH", icon: Folder },
    { id: "company", label: "Documentos Empresa", icon: FileIcon },
    { id: "upload", label: "Meus Envios", icon: UploadCloud },
  ];

  const filteredDocs = docs.filter(d => d.category === activeTab);

  // Helper parser for Brazilian date strings DD/MM/YYYY
  const parseDueDate = (dateStr?: string) => {
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

  // Generate highlight metadata for files with upcoming maturities (due-dates)
  const getDueHighlight = (doc: any) => {
    if (doc.status === "paid") {
      return { 
        text: "Pago", 
        badgeStyle: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300", 
        borderStyle: "border-slate-100 dark:border-slate-800/60" 
      };
    }
    if (!doc.dueDate) {
      return { 
        text: "Pendente", 
        badgeStyle: "bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400", 
        borderStyle: "border-slate-200 dark:border-slate-800" 
      };
    }

    const todayDate = new Date(2026, 5, 22); // Target reference June 22, 2026
    const parsedDue = parseDueDate(doc.dueDate);

    if (!parsedDue) {
      return { 
        text: "Pendente", 
        badgeStyle: "bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400", 
        borderStyle: "border-slate-200 dark:border-slate-800" 
      };
    }

    const diffDays = differenceInDays(parsedDue, todayDate);

    if (diffDays < 0) {
      return { 
        text: `Atrasado há ${Math.abs(diffDays)}d 🚨`, 
        badgeStyle: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400 animate-pulse font-extrabold", 
        borderStyle: "border-rose-200 dark:border-rose-900/60 bg-rose-50/10 dark:bg-rose-950/5",
        isAlert: true 
      };
    } else if (diffDays <= 4) {
      return { 
        text: `Vence em ${diffDays}d ⚠️`, 
        badgeStyle: "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400 font-extrabold", 
        borderStyle: "border-amber-200 dark:border-amber-900/40 bg-amber-50/10 dark:bg-amber-950/5",
        isAlert: true 
      };
    } else {
      return { 
        text: `Pendente (Vence em ${doc.dueDate})`, 
        badgeStyle: "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400", 
        borderStyle: "border-slate-200 dark:border-slate-800" 
      };
    }
  };

  return (
    <div className="space-y-6 pb-20 px-4 sm:px-6 max-w-7xl mx-auto">
      <header className="pt-3">
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Cofre Digital</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Acesse, baixe e visualize guias, folha de pagamento e certidões enviadas pelo escritório.</p>
      </header>

      <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-100 dark:border-slate-850 rounded-3xl overflow-hidden shadow-sm">
        
        {/* Responsive, fluid custom tabs bar */}
        <div className="flex border-b border-slate-100 dark:border-slate-700/50 overflow-x-auto p-2 scrollbar-thin">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-4 py-2.5 text-xs font-bold whitespace-nowrap transition-colors rounded-xl min-h-[44px] ${
                  activeTab === tab.id 
                    ? "bg-slate-900 text-white dark:bg-virgula-green dark:text-white" 
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/50 dark:hover:bg-slate-700/30"
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            )
          })}
        </div>
        
        <div className="p-4 sm:p-6">
          {activeTab === "upload" && (
            <div className="mb-6 p-5 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-slate-200 dark:border-slate-700/60 border-dashed">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-750 dark:text-slate-300 mb-3">Enviar novo documento para o Contador</h3>
              <form onSubmit={handleUpload} className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="w-full sm:flex-1">
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Descrição / Finalidade do Arquivo</label>
                  <input name="title" type="text" required placeholder="Ex: Extrato Bancário Conciliado Jan/2026" className="w-full h-10 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-850 dark:text-white" />
                </div>
                <div className="w-full sm:flex-1">
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">Anexo Documento (Imagens ou PDF)</label>
                  <input type="file" className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-100 dark:file:bg-slate-700 file:text-slate-700 dark:file:text-slate-350 hover:file:bg-slate-200" />
                </div>
                <button type="submit" className="w-full sm:w-auto h-10 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white px-6 rounded-xl text-xs font-bold transition-all shrink-0">
                  Enviar para Análise
                </button>
              </form>
            </div>
          )}

          {filteredDocs.length === 0 ? (
            <div className="py-16 text-center text-slate-400/80">
              <Folder className="w-12 h-12 text-slate-300 dark:text-slate-650 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhum documento cadastrado</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Sua contabilidade ainda não postou guias nesta categoria para a competência selecionada.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredDocs.map(doc => {
                const highlights = getDueHighlight(doc);

                return (
                  <div 
                    key={doc.id} 
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-2xl transition-all gap-4 ${highlights.borderStyle} ${
                      doc.status !== "paid" && doc.dueDate ? "bg-slate-50/20 dark:bg-slate-900/10 hover:shadow-xs" : "bg-white/50 dark:bg-slate-900/5 hover:bg-white dark:hover:bg-slate-850"
                    }`}
                  >
                    <div className="flex items-start sm:items-center">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mr-4 shrink-0 shadow-xs border ${
                        highlights.isAlert 
                          ? "bg-rose-50 border-rose-200 text-rose-500 dark:bg-rose-950/30 dark:border-rose-900/50" 
                          : "bg-white dark:bg-slate-805 border-slate-100 dark:border-slate-800 text-slate-500"
                      }`}>
                        {doc.category === 'taxes' ? <Receipt className="w-5 h-5" /> : <FileIcon className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-slate-800 dark:text-white text-sm">{doc.title}</h4>
                          <span className={`px-2 py-0.5 text-[9px] uppercase font-bold rounded-full ${highlights.badgeStyle}`}>
                            {highlights.text}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-450 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                          <span>Adicionado em: {format(parseISO(doc.createdAt), "dd/MM/yyyy", { locale: ptBR })}</span>
                          <span>•</span>
                          <span>Competência: {doc.competence || "Todos"}</span>
                          {doc.dueDate && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-350">
                                <Clock className="w-3 h-3 text-amber-500" /> Vence em: {doc.dueDate}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {doc.fileUrl && (
                        <a 
                          href={doc.fileUrl} 
                          target="_blank" 
                          referrerPolicy="no-referrer"
                          rel="noreferrer"
                          className="h-9 px-3 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 rounded-xl text-xs font-bold shadow-xs transition-colors"
                          title="Visualizar documento"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" /> Ver Guia
                        </a>
                      )}
                      
                      {doc.fileUrl && (
                        <a 
                          href={doc.fileUrl} 
                          target="_blank" 
                          download
                          referrerPolicy="no-referrer"
                          rel="noreferrer"
                          className="h-9 w-9 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 rounded-xl shadow-xs transition-colors"
                          title="Baixar PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
