const fs = require('fs');
const content = fs.readFileSync('src/pages/client/Dashboard.tsx', 'utf8');

const target = `  const handleRequestPushPermission = async () => {
    try {
      if ("Notification" in window) {`;

const replacement = `  const handleRequestPushPermission = async (auto = false) => {
    try {
      if ("Notification" in window) {`;

const target2 = `        if (permission === "granted") {
          await subscribeToPush();
        } else if (permission === "denied") {
          alert("As notificações estão bloqueadas no seu navegador. Você precisa ir nas configurações do navegador ou do aplicativo para permitir.");
        }
      } else {
        alert("Seu dispositivo ou navegador não suporta notificações web (no iOS, você precisa adicionar à Tela de Início primeiro).");
      }
    } catch (e) {
      console.error("Erro ao solicitar notificações:", e);
      alert("Erro ao solicitar permissão de notificações.");
    }
  };`;

const replacement2 = `        if (permission === "granted") {
          await subscribeToPush();
        } else if (permission === "denied") {
          if (!auto) alert("As notificações estão bloqueadas no seu navegador. Você precisa ir nas configurações do navegador ou do aplicativo para permitir.");
        }
      } else {
        if (!auto) alert("Seu dispositivo ou navegador não suporta notificações web (no iOS, você precisa adicionar à Tela de Início primeiro).");
      }
    } catch (e) {
      console.error("Erro ao solicitar notificações:", e);
      if (!auto) alert("Erro ao solicitar permissão de notificações.");
    }
  };`;

if (content.includes(target) && content.includes(target2)) {
  fs.writeFileSync('src/pages/client/Dashboard.tsx', content.replace(target, replacement).replace(target2, replacement2));
  console.log("Successfully replaced handle args");
} else {
  console.log("Target not found");
}
