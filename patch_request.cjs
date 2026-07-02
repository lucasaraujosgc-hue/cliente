const fs = require('fs');
const content = fs.readFileSync('src/pages/client/Dashboard.tsx', 'utf8');

const target = `  const handleRequestPushPermission = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      if (permission === "granted") {
        subscribeToPush();
      }
    }
  };`;

const replacement = `  const handleRequestPushPermission = async () => {
    try {
      if ("Notification" in window) {
        let permission = Notification.permission;
        
        // Safari PWA or older browsers might use a callback
        const requestPromise = Notification.requestPermission((res) => {
          permission = res;
        });
        
        if (requestPromise && typeof requestPromise.then === "function") {
          permission = await requestPromise;
        }

        setPushPermission(permission);
        if (permission === "granted") {
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

if (content.includes(target)) {
  fs.writeFileSync('src/pages/client/Dashboard.tsx', content.replace(target, replacement));
  console.log("Successfully replaced");
} else {
  console.log("Target not found");
}
