import { useEffect, useState, FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Send, UploadCloud, MessageSquare } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function ClientDetail() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);

  const loadData = () => {
    fetch(`/api/accountant/client/${id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("accountantToken")}` }
    })
      .then(r => r.json())
      .then(setData);
  }

  useEffect(() => loadData(), [id]);

  const handleUpload = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await fetch("/api/accountant/upload-doc", {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${localStorage.getItem("accountantToken")}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ 
        clientId: id, 
        title: formData.get("title"),
        category: formData.get("category"),
        competence: formData.get("competence"),
        dueDate: formData.get("dueDate"),
      })
    });
    (e.target as HTMLFormElement).reset();
    loadData();
    alert("Documento disponibilizado!");
  };

  const handleSendMessage = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await fetch("/api/accountant/message", {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${localStorage.getItem("accountantToken")}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ 
        clientId: id, 
        content: formData.get("content")
      })
    });
    (e.target as HTMLFormElement).reset();
    loadData();
    alert("Mensagem enviada no mural do cliente!");
  };

  if (!data) return null;

  return (
    <div className="space-y-8 animate-in fade-in">
      <header className="flex items-center gap-4 bg-white/40 backdrop-blur-md border border-white rounded-2xl shadow-sm px-6 py-4 -mx-4">
        <Link to="/admin/clients" className="p-2 bg-white/80 border border-white rounded-lg text-slate-500 hover:text-slate-900 transition-colors shadow-sm">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">{data.client.name}</h1>
          <p className="text-slate-500 text-xs mt-1">CNPJ: {data.client.cnpj} • <span className={`font-semibold ${data.client.regularityStatus === 'green' ? 'text-emerald-600' : 'text-amber-600'}`}>Status: {data.client.regularityStatus}</span></p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Upload Manual Panel */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white shadow-xl shadow-slate-200/50 overflow-hidden">
           <div className="px-6 py-4 border-b border-white bg-white/50 flex flex-col justify-center">
             <h3 className="font-semibold text-slate-800 text-sm flex items-center"><UploadCloud className="w-4 h-4 mr-2" /> Upload Manual de Guia/Documento</h3>
           </div>
           <form onSubmit={handleUpload} className="p-6 space-y-4">
              <div>
                 <label className="block text-xs font-semibold text-slate-500 mb-1">Título do Arquivo</label>
                 <input name="title" required className="w-full px-3 py-2 text-sm border border-slate-200 bg-white/50 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: DAS Junho 2026"/>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                   <label className="block text-xs font-semibold text-slate-500 mb-1">Categoria</label>
                   <select name="category" className="w-full px-3 py-2 text-sm border border-slate-200 bg-white/50 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="taxes">Guia / Imposto</option>
                      <option value="payroll">Folha / Pró-labore</option>
                      <option value="company">Doc Empresa (Societário)</option>
                   </select>
                </div>
                <div className="flex-1">
                   <label className="block text-xs font-semibold text-slate-500 mb-1">Competência</label>
                   <input type="text" name="competence" placeholder="MM/yyyy" className="w-full px-3 py-2 text-sm border border-slate-200 bg-white/50 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"/>
                </div>
                <div className="flex-1">
                   <label className="block text-xs font-semibold text-slate-500 mb-1">Vencimento (Opc.)</label>
                   <input type="date" name="dueDate" className="w-full px-3 py-2 text-sm border border-slate-200 bg-white/50 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Arquivo Fiscal/PDF</label>
                <input type="file" required className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200" />
              </div>
              <div className="pt-2">
                 <button type="submit" className="w-full bg-slate-900 text-white py-2.5 rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors shadow-md">
                    Disponibilizar no Cofre do Cliente
                 </button>
              </div>
           </form>
        </div>

       {/* Message Panel */}
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white shadow-xl shadow-slate-200/50 overflow-hidden flex flex-col">
           <div className="px-6 py-4 border-b border-white bg-white/50 flex flex-col justify-center">
             <h3 className="font-semibold text-slate-800 text-sm flex items-center"><MessageSquare className="w-4 h-4 mr-2" /> Mural de Recados</h3>
           </div>
           
           <div className="flex-1 overflow-auto p-6 space-y-4 max-h-[300px]">
              {data.messages.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Nenhum recado enviado.</p>}
              {data.messages.map((m:any) => (
                 <div key={m.id} className="bg-blue-50/80 backdrop-blur-md border border-blue-100/50 text-blue-900 p-4 rounded-2xl text-sm shadow-sm shadow-blue-50">
                    <p className="font-medium">{m.content}</p>
                    <span className="text-[10px] uppercase font-bold text-blue-400/80 mt-2 block">{format(parseISO(m.createdAt), "dd MMM HH:mm", {locale: ptBR})}</span>
                 </div>
              ))}
           </div>

           <form onSubmit={handleSendMessage} className="p-4 border-t border-white bg-white/60 flex gap-2">
              <input name="content" required placeholder="Digite um aviso importante..." className="flex-1 px-4 py-2.5 text-sm border border-slate-200 bg-white/80 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"/>
              <button type="submit" className="bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-colors shadow-md">
                 <Send className="w-4 h-4" />
              </button>
           </form>
        </div>

      </div>

      <div className="bg-white/80 backdrop-blur-xl border text-slate-900 border-white rounded-3xl overflow-hidden shadow-xl shadow-slate-200/50 mt-8">
        <div className="px-6 py-4 border-b border-white bg-white/50 flex items-center justify-between">
           <h3 className="font-semibold text-slate-800">Todos os Documentos do Cliente</h3>
        </div>
        <div className="divide-y divide-slate-100/50 max-h-[400px] overflow-auto">
          {data.documents.length === 0 && (
            <div className="p-8 text-center text-slate-500">Nenhum documento encontrado.</div>
          )}
          {data.documents.map((doc: any) => (
            <div key={doc.id} className="p-4 px-6 hover:bg-white flex items-center justify-between">
              <div className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-4 ${doc.uploadedBy === 'client' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                  {doc.uploadedBy === 'client' ? <UploadCloud className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-slate-900">{doc.title} {doc.competence && `(Comp: ${doc.competence})`}</h4>
                  <div className="text-xs text-slate-500 mt-1 flex gap-2 items-center">
                     <span className="font-medium text-slate-700">Origem: {doc.uploadedBy === 'client' ? 'Cliente' : 'Contador'}</span>
                     <span>•</span>
                     <span>Status: {doc.status}</span>
                     <span>•</span>
                     <span>{format(parseISO(doc.createdAt), "dd MMM, yyyy", {locale: ptBR})}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white shadow-xl shadow-slate-200/50 overflow-hidden p-6 mt-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800 text-sm">Integração API (Hash da Empresa)</h3>
          {data.client.integrationHash ? (
            <button 
              onClick={async () => {
                await fetch(`/api/accountant/client/${id}/revoke-token`, {
                  method: "POST",
                  headers: { Authorization: `Bearer ${localStorage.getItem("accountantToken")}` }
                });
                loadData();
              }}
              className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg font-bold hover:bg-red-100"
            >
              Revogar
            </button>
          ) : (
            <button 
              onClick={async () => {
                await fetch(`/api/accountant/client/${id}/generate-token`, {
                  method: "POST",
                  headers: { Authorization: `Bearer ${localStorage.getItem("accountantToken")}` }
                });
                loadData();
              }}
              className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-slate-800"
            >
              Gerar Nova Hash
            </button>
          )}
        </div>
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center justify-between">
           {data.client.integrationHash ? (
              <code className="text-sm font-mono text-slate-600 select-all">{data.client.integrationHash}</code>
           ) : (
              <span className="text-sm text-slate-400">Nenhuma hash ativa. Gere uma para integrar com o sistema principal.</span>
           )}
        </div>
      </div>
    </div>
  );
}
