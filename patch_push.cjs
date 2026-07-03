const fs = require('fs');
let content = fs.readFileSync('src/pages/client/Dashboard.tsx', 'utf8');

// Change pushDismissed key to reset state for user
content = content.replace(/dismissedPushPrompt_v2/g, "dismissedPushPrompt_v4");

// Update handleRequestPushPermission
const handleReqOld = `  const handleRequestPushPermission = async (auto = false) => {
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

const handleReqNew = `  const handleRequestPushPermission = async (auto = false) => {
    try {
      // For iOS non-standalone, we can't request push
      if (isIOS && !isStandalone) {
        if (!auto) alert("No iPhone/iPad, as notificações só funcionam se você adicionar o aplicativo à Tela de Início. Toque em Compartilhar e depois 'Adicionar à Tela de Início'.");
        return;
      }

      if ("Notification" in window) {
        let permission = Notification.permission;
        
        const requestPromise = Notification.requestPermission((res) => {
          permission = res;
        });
        
        if (requestPromise && typeof requestPromise.then === "function") {
          permission = await requestPromise;
        }

        setPushPermission(permission);
        if (permission === "granted") {
          await subscribeToPush();
          if (!auto) alert("Notificações ativadas com sucesso!");
        } else if (permission === "denied") {
          if (!auto) alert("Você bloqueou as notificações. Acesse as configurações do navegador para permitir.");
        }
      } else {
        if (!auto) alert("Seu navegador não suporta notificações web.");
      }
    } catch (e) {
      console.error("Erro ao solicitar notificações:", e);
      if (!auto) alert("Erro ao solicitar permissão de notificações.");
    }
  };`;

if(content.includes('const handleRequestPushPermission = async (auto = false) => {') && content.includes('if (!auto) alert("Erro ao solicitar permissão de notificações.");')) {
  content = content.substring(0, content.indexOf('  const handleRequestPushPermission = async (auto = false) => {')) + handleReqNew + content.substring(content.indexOf('  };', content.indexOf('const handleRequestPushPermission')) + 4);
}


// Replace subscribeToPush
const subscribeOld = `  const subscribeToPush = async () => {`;
const subscribeNew = `  const subscribeToPush = async () => {
    try {
      const isCapacitor = typeof window !== "undefined" && (window as any).Capacitor !== undefined;
      
      let fcmToken = null;
      let subscriptionObject = null;

      if (isCapacitor) {
        const PushNotifications = (window as any).Capacitor.Plugins.PushNotifications;
        if (PushNotifications) {
          let permStatus = await PushNotifications.checkPermissions();
          if (permStatus.receive === 'prompt') {
            permStatus = await PushNotifications.requestPermissions();
          }
          if (permStatus.receive !== 'granted') return;
          
          await PushNotifications.register();
          
          fcmToken = await new Promise((resolve) => {
            PushNotifications.addListener('registration', (token: any) => resolve(token.value));
            PushNotifications.addListener('registrationError', () => resolve(null));
            setTimeout(() => resolve(null), 5000);
          });
        }
      } else if ("serviceWorker" in navigator && "PushManager" in window) {
        if (Notification.permission !== "granted") return;

        const registration = await navigator.serviceWorker.ready;
        
        const response = await apiFetch("/api/vapidPublicKey");
        const vapidPublicKey = await response.text();
        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

        // Always unsubscribe old to ensure fresh key
        const oldSub = await registration.pushManager.getSubscription();
        if (oldSub) {
          await oldSub.unsubscribe().catch(e => console.error("Error unsubscribing", e));
        }

        subscriptionObject = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });
      }

      if (fcmToken || subscriptionObject) {
        await apiFetch("/api/notifications/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscriptionObject,
            fcmToken,
            deviceName: navigator.userAgent
          })
        });
        console.log("Push notifications subscribed successfully!");
      }
    } catch (e) {
      console.error("Failed to subscribe to push notifications", e);
    }
  };`;

// Using manual replace for subscribeToPush
const subscribeStart = content.indexOf('  const subscribeToPush = async () => {');
if(subscribeStart !== -1) {
  const subscribeEnd = content.indexOf('  }, []);', subscribeStart);
  if(subscribeEnd !== -1) {
     content = content.substring(0, subscribeStart) + subscribeNew + "\n" + content.substring(subscribeEnd + 9);
  }
}

// Update the Modal condition
const modalTarget = `{pushPermission === "default" && !pushDismissed && typeof window !== "undefined" && "Notification" in window && !((window as any).Capacitor !== undefined) && (!isIOS || isStandalone) && (`;
const modalReplacement = `{pushPermission === "default" && !pushDismissed && typeof window !== "undefined" && !((window as any).Capacitor !== undefined) && (`;
content = content.replace(modalTarget, modalReplacement);

fs.writeFileSync('src/pages/client/Dashboard.tsx', content);
console.log("Dashboard patched!");
