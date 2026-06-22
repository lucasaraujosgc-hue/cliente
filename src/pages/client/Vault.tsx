import { useState, useEffect, FormEvent } from "react";
import { Folder, Receipt, FileIcon, Eye, Download, UploadCloud } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function ClientVault() {
  const [docs, setDocs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("taxes");

  const loadDocs = () => {
    fetch("/api/client/dashboard", {
      headers: { Authorization: `Bearer ${localStorage.getItem("clientToken")}` }
    })
      .then(r => r.json())
      .then(data => setDocs(data.documents));
  };

  useEffect(() => loadDocs(), []);

  const handleUpload = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    
    await fetch("/api/client/upload", {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${localStorage.getItem("clientToken")}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ title, category: "upload" })
    });
    
    (e.target as HTMLFormElement).reset();
    loadDocs();
    alert("Enviado com sucesso!");
  };

  const tabs = [
    { id: "taxes", label: "Guias de Impostos", icon: Receipt },
    { id: "payroll", label: "Folha/RH", icon: Folder },
    { id: "company", label: "Documentos Empresa", icon: FileIcon },
    { id: "upload", label: "Meus Envios", icon: UploadCloud },
  ];

  const filteredDocs = docs.filter(d => d.category === activeTab);

  return (
    <div className="space-y-8 min-h-full">
      <header className="h-16 flex items-center justify-between px-8 bg-white/40 backdrop-blur-md border border-white rounded-2xl shadow-sm -mx-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Cofre Digital</h1>
          <p className="text-xs text-slate-500">Acesse, baixe e envie documentos contábeis.</p>
        </div>
      </header>

      <div className="bg-white/80 backdrop-blur-xl border border-white rounded-3xl overflow-hidden shadow-xl shadow-slate-200/50">
        <div className="flex border-b border-white overflow-x-auto p-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-6 py-3 text-sm font-medium whitespace-nowrap transition-colors rounded-lg ${
                  activeTab === tab.id 
                    ? "bg-white shadow-sm text-slate-900" 
                    : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            )
          })}
        </div>
        
        <div className="p-6">
          {activeTab === "upload" && (
            <div className="mb-8 p-6 bg-slate-50 rounded-xl border border-slate-200 border-dashed">
              <h3 className="text-sm font-semibold text-slate-800 mb-4">Enviar novo documento para a Contabilidade</h3>
              <form onSubmit={handleUpload} className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Descrição do Arquivo</label>
                  <input name="title" type="text" required placeholder="Ex: Extrato Bancário Jan/2026" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Anexo (Mock)</label>
                  <input type="file" className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                </div>
                <button type="submit" className="bg-slate-900 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors h-10">Enviar</button>
              </form>
            </div>
          )}

          {filteredDocs.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Folder className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              Nenhum documento nesta pasta.
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredDocs.map(doc => (
                <div key={doc.id} className="flex items-center justify-between p-4 border border-white bg-white/50 hover:bg-white rounded-2xl transition-colors shadow-sm">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-white border border-slate-100 shadow-sm rounded-xl flex items-center justify-center text-slate-500 mr-4">
                      {doc.category === 'taxes' ? <Receipt className="w-5 h-5"/> : <FileIcon className="w-5 h-5"/>}
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-900 text-sm">{doc.title}</h4>
                      <div className="text-xs text-slate-500 mt-0.5 flex gap-3">
                        <span>Adicionado em: {format(parseISO(doc.createdAt), "dd/MM/yyyy", {locale: ptBR})}</span>
                        {doc.dueDate && <span>• Vence: {doc.dueDate}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 text-[10px] uppercase tracking-wider font-semibold rounded-full ${
                      doc.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      doc.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-slate-200 text-slate-600'
                    }`}>
                      {doc.status}
                    </span>
                    <button className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" title="Visualizar">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" title="Download PDF">
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
