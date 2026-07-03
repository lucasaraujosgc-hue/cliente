const fs = require('fs');
let content = fs.readFileSync('src/pages/client/Dashboard.tsx', 'utf8');

const target = `subscriptionObject = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });`;

const replacement = `try {
          subscriptionObject = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey
          });
        } catch (subErr: any) {
          // If the server's VAPID key changed, it throws an error. We need to unsubscribe and try again.
          if (subErr.message && subErr.message.includes("applicationServerKey")) {
            console.warn("VAPID key changed, resetting subscription...");
            const oldSub = await registration.pushManager.getSubscription();
            if (oldSub) await oldSub.unsubscribe();
            subscriptionObject = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: convertedVapidKey
            });
          } else {
            throw subErr;
          }
        }`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync('src/pages/client/Dashboard.tsx', content);
  console.log("Successfully patched push subscription recovery.");
} else {
  console.log("Target not found.");
}
