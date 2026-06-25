import React, { useState } from "react";
import { RefreshCw, FileText, Send } from "lucide-react";

interface Guia {
  id: string; // The document ID
  tipoGuia: string;
  competencia: string; // 'MM/YYYY' or 'MM/YYYY' converted
  dataVencimento?: string;
  valor?: number;
  status: string; // we can pass our own status
  title?: string;
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

        onAtualizado({
          ...guia,
          status: "GUIA_ATUALIZADA",
          dataVencimento: data.dataVencimento,
          valor: data.valorTotal,
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
         
         setMensagemEnviada(true);
      }
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
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
      )}
      {mensagemEnviada && (
        <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
            <span className="text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1">
                <Send className="w-3.5 h-3.5" /> Mensagem enviada ao contador!
            </span>
        </div>
      )}
      {erro && <span className="text-xs text-red-500 font-bold">{erro}</span>}
    </div>
  );
}
