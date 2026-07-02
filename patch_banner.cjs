const fs = require('fs');
const content = fs.readFileSync('src/pages/client/Dashboard.tsx', 'utf8');

let newContent = content;
if (!newContent.includes('Bell,')) {
  newContent = newContent.replace('import {', 'import { Bell,');
}

const bannerTarget = `      {showPwaBanner && (
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
      )}`;

const bannerReplacement = `      {showPwaBanner && (
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

      {/* 🔔 PUSH NOTIFICATION BANNER */}
      {pushPermission === "default" && typeof window !== "undefined" && !((window as any).Capacitor !== undefined) && (
        <div className="relative bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-5 rounded-3xl shadow-lg border border-blue-500/20 flex flex-col sm:flex-row items-center sm:justify-between gap-4 overflow-hidden transform duration-250 hover:shadow-xl mt-3">
          <div className="absolute top-0 right-0 p-16 bg-white/5 rounded-full translate-x-12 -translate-y-12 pointer-events-none"></div>
          <div className="flex items-center gap-4 z-10">
            <div className="p-3 bg-white/15 backdrop-blur-md rounded-2xl text-blue-100 animate-pulse shrink-0">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm sm:text-base tracking-tight">Ative as Notificações</h4>
              <p className="text-blue-100 text-xs mt-1 leading-relaxed max-w-xl">
                Não perca prazos! Ative as notificações para ser avisado sobre vencimentos de impostos e novos documentos importantes.
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0 z-10 self-end sm:self-center">
            <button 
              onClick={handleRequestPushPermission}
              className="px-4 py-2 bg-white text-blue-700 hover:bg-blue-50 font-bold rounded-xl transition-all text-sm whitespace-nowrap"
            >
              Ativar Agora
            </button>
            <button 
              onClick={() => setPushPermission("denied")} 
              className="p-2 bg-black/10 hover:bg-black/25 rounded-xl text-white transition-all"
              title="Agora não"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}`;

if (newContent.includes(bannerTarget)) {
  fs.writeFileSync('src/pages/client/Dashboard.tsx', newContent.replace(bannerTarget, bannerReplacement));
  console.log("Successfully replaced banner");
} else {
  console.log("Banner target not found");
}
