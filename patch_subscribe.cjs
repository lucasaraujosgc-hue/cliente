const fs = require('fs');
const content = fs.readFileSync('src/server/routes.ts', 'utf8');

const target = `        await db.insert(subscriptions).values({
          clientId,
          subscriptionObject,
          fcmToken,
          deviceName: deviceName || "Dispositivo",
        });`;

const replacement = `        // Check if subscription already exists for this client to avoid duplicates
        const existingSubs = await db.select().from(subscriptions).where(eq(subscriptions.clientId, clientId));
        let exists = false;
        if (subscriptionObject) {
          const subObjStr = JSON.stringify(subscriptionObject);
          exists = existingSubs.some(s => s.subscriptionObject && JSON.stringify(s.subscriptionObject) === subObjStr);
        } else if (fcmToken) {
          exists = existingSubs.some(s => s.fcmToken === fcmToken);
        }

        if (!exists) {
          await db.insert(subscriptions).values({
            clientId,
            subscriptionObject,
            fcmToken,
            deviceName: deviceName || "Dispositivo",
          });
        }`;

if (content.includes(target)) {
  fs.writeFileSync('src/server/routes.ts', content.replace(target, replacement));
  console.log("Successfully replaced");
} else {
  console.log("Target not found");
}
