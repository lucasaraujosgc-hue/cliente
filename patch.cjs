const fs = require('fs');
const content = fs.readFileSync('src/pages/client/Dashboard.tsx', 'utf8');

const target = `  const subscribeToPush = async () => {
    try {
      const isCapacitor = typeof window !== "undefined" && (window as any).Capacitor !== undefined;
      
      let fcmToken = null;
      let subscriptionObject = null;

      if (isCapacitor) {
        // Handle Capacitor Mobile Push Notifications (FCM)
        const PushNotifications = (window as any).Capacitor.Plugins.PushNotifications;
        if (PushNotifications) {
          let permStatus = await PushNotifications.checkPermissions();
          if (permStatus.receive === 'prompt') {
            permStatus = await PushNotifications.requestPermissions();
          }
          if (permStatus.receive !== 'granted') {
            throw new Error('User denied push permission');
          }
          
          await PushNotifications.register();
          
          // Wait for token using a Promise
          fcmToken = await new Promise((resolve, reject) => {
            PushNotifications.addListener('registration', (token: any) => {
              resolve(token.value);
            });
            PushNotifications.addListener('registrationError', (error: any) => {
              reject(error);
            });
            // Timeout just in case it doesn't fire
            setTimeout(() => resolve(null), 5000);
          });
        }
      } else if ("serviceWorker" in navigator && "PushManager" in window) {
        // Handle Web Push (PWA/Browser)
        const registration = await navigator.serviceWorker.ready;
        
        // Get public key
        const response = await apiFetch("/api/vapidPublicKey");
        const vapidPublicKey = await response.text();
        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

        subscriptionObject = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });
      }

      if (fcmToken || subscriptionObject) {
        await apiFetch("/api/notifications/subscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            subscriptionObject,
            fcmToken,
            deviceName: navigator.userAgent
          })
        });
        console.log("Push notifications subscribed!");
      }
    } catch (e) {
      console.error("Failed to subscribe to push notifications", e);
    }
  };

  useEffect(() => {
    loadData();
    subscribeToPush();
  }, []);`;

const replacement = `  const checkPushPermission = () => {
    const isCapacitor = typeof window !== "undefined" && (window as any).Capacitor !== undefined;
    if (!isCapacitor && "Notification" in window) {
      setPushPermission(Notification.permission);
    }
  };

  const handleRequestPushPermission = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      if (permission === "granted") {
        subscribeToPush();
      }
    }
  };

  const subscribeToPush = async () => {
    try {
      const isCapacitor = typeof window !== "undefined" && (window as any).Capacitor !== undefined;
      
      let fcmToken = null;
      let subscriptionObject = null;

      if (isCapacitor) {
        // Handle Capacitor Mobile Push Notifications (FCM)
        const PushNotifications = (window as any).Capacitor.Plugins.PushNotifications;
        if (PushNotifications) {
          let permStatus = await PushNotifications.checkPermissions();
          if (permStatus.receive === 'prompt') {
            permStatus = await PushNotifications.requestPermissions();
          }
          if (permStatus.receive !== 'granted') {
            throw new Error('User denied push permission');
          }
          
          await PushNotifications.register();
          
          // Wait for token using a Promise
          fcmToken = await new Promise((resolve, reject) => {
            PushNotifications.addListener('registration', (token: any) => {
              resolve(token.value);
            });
            PushNotifications.addListener('registrationError', (error: any) => {
              reject(error);
            });
            // Timeout just in case it doesn't fire
            setTimeout(() => resolve(null), 5000);
          });
        }
      } else if ("serviceWorker" in navigator && "PushManager" in window) {
        // Handle Web Push (PWA/Browser)
        if (Notification.permission !== "granted") {
          return;
        }

        const registration = await navigator.serviceWorker.ready;
        
        // Get public key
        const response = await apiFetch("/api/vapidPublicKey");
        const vapidPublicKey = await response.text();
        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

        subscriptionObject = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });
      }

      if (fcmToken || subscriptionObject) {
        await apiFetch("/api/notifications/subscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            subscriptionObject,
            fcmToken,
            deviceName: navigator.userAgent
          })
        });
        console.log("Push notifications subscribed!");
      }
    } catch (e) {
      console.error("Failed to subscribe to push notifications", e);
    }
  };

  useEffect(() => {
    loadData();
    checkPushPermission();
    subscribeToPush();
  }, []);`;

if (content.includes(target)) {
  fs.writeFileSync('src/pages/client/Dashboard.tsx', content.replace(target, replacement));
  console.log("Successfully replaced");
} else {
  console.log("Target not found");
}
