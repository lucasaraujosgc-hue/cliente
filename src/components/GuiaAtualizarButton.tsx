import React, { useState } from "react";
import { RefreshCw, FileText, Send, Copy, Check } from "lucide-react";

interface Guia {
  id: string; // The document ID
  tipoGuia: string;
  competencia: string; // 'MM/YYYY' or 'MM/YYYY' converted
  dataVencimento?: string;
  valor?: number;
  status: string; // we can pass our own status
  title?: string;
  pixCode?: string;
}

interface Props {
  clienteId: string;
  guia: Guia;
  onAtualizado: (novaGuia: any) => void;
  isOverdue: boolean;
}

export function GuiaAtualizarButton({ clienteId, guia, onAtualizado, isOverdue }: Props) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizada, setAtualizada] = useState(false);
  const [mensagemEnviada, setMensagemEnviada] = useState(false);
  const [novaDataVencimento, setNovaDataVencimento] = useState("");
  const [pdfPath, setPdfPath] = useState("");
  const [pixCode, setPixCode] = useState("");
  const [copied, setCopied] = useState(false);

  const isSupported = guia.tipoGuia === "DCTFWEB_INSS" || guia.tipoGuia === "DAS_SIMPLES";
  const tipoLabel = guia.tipoGuia === "DCTFWEB_INSS" ? "INSS" : (guia.tipoGuia === "DAS_SIMPLES" ? "DAS Simples" : (guia.title || "Guia"));

  async function handleAtualizar() {
    setLoading(true);
    setErro(null);
    try {
      const token = localStorage.getItem("clientToken") || sessionStorage.getItem("clientToken");
      
      if (isSupported) {
        const parts = guia.competencia.split("/");
        const compStr = parts.length === 2 ? `${parts[1]}${parts[0]}` : "202605";

        const res = await fetch(`/api/pendencies/guia/${clienteId}`, {
          method: "POST",
          headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}` 
          },
          body: JSON.stringify({ tipoGuia: guia.tipoGuia, competencia: compStr, documentId: guia.id }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Erro ao gerar guia.");
        }
        const data = await res.json();
        setAtualizada(true);
        setNovaDataVencimento(data.dataVencimento);
        setPdfPath(data.pdfPath);
        if (data.pixCode) {
            setPixCode(data.pixCode);
        }

        onAtualizado({
          ...guia,
          status: "GUIA_ATUALIZADA",
          dataVencimento: data.dataVencimento,
          valor: data.valorTotal,
          pixCode: data.pixCode
        });
      } else {
         // Send message to accountant
         const msg = `Por favor, preciso recalcular a guia: ${tipoLabel} - Competência: ${guia.competencia}.`;
         const res = await fetch(`/api/client/message`, {
             method: "POST",
             headers: {
                 "Content-Type": "application/json",
                 "Authorization": `Bearer ${token}`
             },
             body: JSON.stringify({ content: msg, clientId: clienteId })
         });
         
         if (!res.ok) {
            throw new Error("Erro ao enviar mensagem.");
         }
         
         await fetch(`/api/client/mark-doc/${guia.id}`, {
             method: "POST",
             headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
             body: JSON.stringify({ status: "waiting_accountant" })
         });

         setMensagemEnviada(true);
         onAtualizado({...guia, aguardandoContador: true}); // Trigger refresh maybe
      }
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }

  const handleCopyPix = () => {
      navigator.clipboard.writeText(pixCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {loading && isSupported && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
           <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl flex flex-col items-center gap-4 animate-in zoom-in-95 duration-200">
               <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                   <RefreshCw className="w-6 h-6 text-indigo-600 dark:text-indigo-400 animate-spin" />
               </div>
               <div className="text-center">
                   <h3 className="font-bold text-slate-800 dark:text-white">Calculando guia...</h3>
                   <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Conectando ao Integra Contador</p>
               </div>
           </div>
        </div>
      )}

      <div className="flex flex-col gap-2 w-full mt-2">
        {isOverdue && !atualizada && !mensagemEnviada && (
          <button
            onClick={handleAtualizar}
            disabled={loading}
            className="flex items-center justify-center gap-2 h-10 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-transform active:scale-95 disabled:opacity-50"
            title={`Recalcular ${tipoLabel}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? (isSupported ? "Calculando..." : "Enviando...") : `Recalcular`}
          </button>
        )}
        {atualizada && novaDataVencimento && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    Atualizada! Novo Venc.: {novaDataVencimento.split("-").reverse().join("/")}
                </span>
                {pdfPath && (
                    <a href={pdfPath} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline">
                        <FileText className="w-3.5 h-3.5" /> PDF
                    </a>
                )}
            </div>
            {pixCode && (
                <button
                    onClick={handleCopyPix}
                    className="flex items-center justify-center gap-2 h-10 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-transform active:scale-95"
                >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "PIX Copiado!" : "Copiar PIX"}
                </button>
            )}
          </div>
        )}
        {mensagemEnviada && (
          <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
              <span className="text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1">
                  <Send className="w-3.5 h-3.5" /> Aguardando contador enviar a guia.
              </span>
          </div>
        )}
        {erro && <span className="text-xs text-red-500 font-bold">{erro}</span>}
      </div>
    </>
  );
}
