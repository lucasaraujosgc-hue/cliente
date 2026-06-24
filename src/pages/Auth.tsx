import React, { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Calculator } from "lucide-react";

export function Login() {
  const [cnpj, setCnpj] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, "");
    if (v.length <= 11) {
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d)/, "$1.$2");
        v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
        v = v.replace(/^(\d{2})(\d)/, "$1.$2");
        v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
        v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
        v = v.replace(/(\d{4})(\d)/, "$1-$2");
    }
    setCnpj(v.substring(0, 18));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/auth/client/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cnpj, password })
      });
      const data = await res.json();
      if (res.ok) {
        if (data.role === "accountant") {
           localStorage.setItem("accountantToken", data.token);
           navigate("/admin");
           return;
        }

        if (rememberMe) {
           localStorage.setItem("clientToken", data.token);
           localStorage.setItem("clientUser", JSON.stringify(data.client));
        } else {
           sessionStorage.setItem("clientToken", data.token);
           sessionStorage.setItem("clientUser", JSON.stringify(data.client));
        }
        
        if (data.client.firstAccessDone !== true) {
           navigate("/setup-profile");
        } else {
           navigate("/dashboard");
        }
      } else {
        setError(data.error);
      }
    } catch {
      setError("Erro no servidor");
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-900 flex flex-col relative overflow-hidden transition-colors">
      <div className="absolute inset-0 bg-gradient-to-br from-virgula-green/10 via-white dark:via-slate-900 to-slate-100/50 dark:to-slate-800/50 -z-0"></div>
      <div className="flex-1 flex items-center justify-center p-4 z-10">
        <div className="w-full max-w-md bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 border border-white dark:border-slate-700 p-8">
          <div className="text-center mb-8 flex flex-col items-center">
            
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-virgula-card rounded-xl border border-white/10 flex items-center justify-center text-virgula-green shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                 <Calculator strokeWidth={2.5} className="w-[30px] h-[30px]" />
              </div>
              <div className="flex flex-col justify-center text-left">
                  <span className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-none mb-0.5">Vírgula</span>
                  <span className="text-base font-semibold text-virgula-green tracking-widest leading-none uppercase">Contábil</span>
              </div>
            </div>

            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Portal do Cliente</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Acesse seus documentos e guias contábeis</p>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm rounded-lg border border-red-100 dark:border-red-800">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">CPF ou CNPJ</label>
              <input
                type="text"
                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 bg-white/50 dark:bg-slate-700/50 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-virgula-green focus:border-transparent text-sm"
                placeholder="000.000.000-00 ou 00.000.000/0001-00"
                value={cnpj}
                onChange={handleCnpjChange}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Senha</label>
              <input
                type="password"
                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 bg-white/50 dark:bg-slate-700/50 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-virgula-green focus:border-transparent text-sm"
                placeholder="Sua senha"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            
            <div className="flex items-center">
              <input 
                id="rememberMe" 
                type="checkbox" 
                className="w-4 h-4 text-virgula-green border-slate-300 rounded focus:ring-virgula-green"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
              />
              <label htmlFor="rememberMe" className="ml-2 block text-sm text-slate-600 dark:text-slate-400">
                Permanecer conectado
              </label>
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 dark:bg-virgula-green text-white font-bold py-2.5 rounded-lg hover:bg-slate-800 dark:hover:bg-emerald-600 transition-colors shadow-md"
            >
              Acessar Plataforma
            </button>
            
            <div className="mt-4 text-center">
              <button 
                type="button"
                onClick={() => navigate('/admin/login')}
                className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Acesso para Contadores
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export function AccountantLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/auth/accountant/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("accountantToken", data.token);
        navigate("/admin");
      } else {
        setError(data.error);
      }
    } catch {
      setError("Erro no servidor");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-900 to-slate-900 z-0"></div>
      <div className="w-full max-w-md bg-white/10 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/10 p-8 z-10 mx-4">
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-virgula-card rounded-xl border border-white/10 flex items-center justify-center text-virgula-green shadow-[0_0_20px_rgba(16,185,129,0.25)]">
               <Calculator strokeWidth={2.5} className="w-[30px] h-[30px]" />
            </div>
            <div className="flex flex-col justify-center text-left">
                <span className="text-3xl font-bold text-white tracking-tight leading-none mb-0.5">Vírgula</span>
                <span className="text-base font-semibold text-virgula-green tracking-widest leading-none uppercase">Contábil</span>
            </div>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight mt-2">Área do Contador</h1>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-500/20 border border-red-500/50 text-red-200 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1">Usuário</label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-slate-700 bg-slate-800/50 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1">Senha</label>
            <input
              type="password"
              className="w-full px-4 py-2 border border-slate-700 bg-slate-800/50 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/50"
          >
            Entrar
          </button>

          <div className="mt-4 text-center">
            <button 
              type="button"
              onClick={() => navigate('/login')}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Voltar para Área do Cliente
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
