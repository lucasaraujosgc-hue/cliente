import React, { useState } from "react";
import { RefreshCw, FileText } from "lucide-react";

interface Guia {
  id: string; // The document ID
  tipoGuia: "DCTFWEB_INSS" | "DAS_SIMPLES";
  competencia: string; // 'MM/YYYY' or 'MM/YYYY' converted
  dataVencimento?: string;
  valor?: number;
  status: string; // we can pass our own status
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
  const [novaDataVencimento, setNovaDataVencimento] = useState("");
  const [pdfPath, setPdfPath] = useState("");

  const tipoLabel = guia.tipoGuia === "DCTFWEB_INSS" ? "INSS" : "DAS Simples";

  async function handleAtualizar() {
    setLoading(true);
    setErro(null);
    try {
      const parts = guia.competencia.split("/");
      const compStr = parts.length === 2 ? `${parts[1]}${parts[0]}` : "202605";
      const token = localStorage.getItem("clientToken") || sessionStorage.getItem("clientToken");

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
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 w-full mt-2">
      {isOverdue && !atualizada && (
        <button
          onClick={handleAtualizar}
          disabled={loading}
          className="flex items-center justify-center gap-2 h-10 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-transform active:scale-95 disabled:opacity-50"
          title={`Gerar nova guia de ${tipoLabel} — competência ${guia.competencia}`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Gerando..." : `Atualizar Guia ${tipoLabel}`}
        </button>
      )}
      {atualizada && novaDataVencimento && (
        <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                Guia Atualizada! Novo Venc.: {novaDataVencimento.split("-").reverse().join("/")}
            </span>
            {pdfPath && (
                <a href={pdfPath} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline">
                    <FileText className="w-3.5 h-3.5" /> Abrir PDF
                </a>
            )}
        </div>
      )}
      {erro && <span className="text-xs text-red-500 font-bold">{erro}</span>}
    </div>
  );
}
