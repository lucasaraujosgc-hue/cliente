const fs = require('fs');
const content = fs.readFileSync('src/pages/client/Dashboard.tsx', 'utf8');

const target = `      if (fcmToken || subscriptionObject) {
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
  };`;

const replacement = `      if (fcmToken || subscriptionObject) {
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
        // We can show a small alert or toast, but console.log is fine.
        // Let's at least alert if it's not capacitor so they know it worked.
        if (!isCapacitor) {
           alert("Notificações ativadas com sucesso!");
        }
      }
    } catch (e) {
      console.error("Failed to subscribe to push notifications", e);
      if (!isCapacitor) {
        alert("Erro ao se inscrever nas notificações. Verifique se o navegador suporta Web Push.");
      }
    }
  };`;

if (content.includes(target)) {
  fs.writeFileSync('src/pages/client/Dashboard.tsx', content.replace(target, replacement));
  console.log("Successfully replaced");
} else {
  console.log("Target not found");
}
