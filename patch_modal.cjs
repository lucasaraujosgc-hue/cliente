const fs = require('fs');
const content = fs.readFileSync('src/pages/client/Dashboard.tsx', 'utf8');

const target1 = `  useEffect(() => {
    loadData();
    checkPushPermission();
    
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      const isCapacitor = typeof window !== "undefined" && (window as any).Capacitor !== undefined;
      if (!isCapacitor) {
        // Try auto prompt (may fail on iOS without user gesture)
        setTimeout(() => {
          handleRequestPushPermission(true);
        }, 1000);
      } else {
        subscribeToPush();
      }
    } else {
      subscribeToPush();
    }
  }, []);`;

const replacement1 = `  useEffect(() => {
    loadData();
    checkPushPermission();
    subscribeToPush();
  }, []);`;

const target2 = `      {/* 🔔 PUSH NOTIFICATION BANNER */}
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
              onClick={() => handleRequestPushPermission(false)}
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

const replacement2 = `      {/* 🔔 PUSH NOTIFICATION MODAL (BLOCKING) */}
      {pushPermission === "default" && typeof window !== "undefined" && !((window as any).Capacitor !== undefined) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 flex flex-col items-center text-center text-white">
              <div className="p-4 bg-white/20 backdrop-blur-md rounded-full mb-4 animate-bounce">
                <Bell className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-extrabold tracking-tight mb-2">Ative as Notificações</h3>
              <p className="text-blue-100 text-sm leading-relaxed">
                Não perca prazos importantes! Seja avisado sobre vencimentos de impostos e novos documentos diretamente no seu celular.
              </p>
            </div>
            <div className="p-6 bg-slate-50 flex flex-col gap-3">
              <button 
                onClick={() => handleRequestPushPermission(false)}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all text-base"
              >
                Ativar Notificações
              </button>
              <button 
                onClick={() => setPushPermission("denied")} 
                className="w-full py-3.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 font-semibold rounded-xl transition-all text-base"
              >
                Agora não
              </button>
            </div>
          </div>
        </div>
      )}`;

let newContent = content;

// Replace handleRequestPushPermission call inside the banner (it might not have () =>)
// because it was using onClick={handleRequestPushPermission} before my changes maybe.
// I will just do a generic replace.

if (newContent.includes(target1)) {
  newContent = newContent.replace(target1, replacement1);
} else {
  console.log("Target 1 not found");
}

if (newContent.includes('🔔 PUSH NOTIFICATION BANNER')) {
  // We need to replace the whole block. We can use regex to replace from 🔔 PUSH NOTIFICATION BANNER to the end of the div.
  const startIdx = newContent.indexOf('{/* 🔔 PUSH NOTIFICATION BANNER */}');
  const endIdxStr = '</div>\n        </div>\n      )}';
  const endIdx = newContent.indexOf(endIdxStr, startIdx) + endIdxStr.length;
  if (startIdx !== -1 && endIdx !== -1) {
    const blockToReplace = newContent.substring(startIdx, endIdx);
    newContent = newContent.replace(blockToReplace, replacement2);
    console.log("Replaced target 2 via index");
  } else {
    console.log("Could not find end of target 2");
  }
}

if (newContent !== content) {
  fs.writeFileSync('src/pages/client/Dashboard.tsx', newContent);
  console.log("Successfully replaced");
} else {
  console.log("No changes made");
}
