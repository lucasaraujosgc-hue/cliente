const fs = require('fs');
let content = fs.readFileSync('src/server/routes.ts', 'utf8');

const target2 = `import path from "path";`;

const replacement2 = `import path from "path";

if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
  try {
    if (fs.existsSync(vapidPath)) {
      vapidKeys = JSON.parse(fs.readFileSync(vapidPath, 'utf-8'));
    } else {
      vapidKeys = webpush.generateVAPIDKeys();
      fs.writeFileSync(vapidPath, JSON.stringify(vapidKeys, null, 2));
      console.log("Generated and saved new VAPID keys to .vapid.json");
    }
  } catch (e) {
    console.error("Error reading/writing VAPID keys", e);
    vapidKeys = webpush.generateVAPIDKeys();
  }
}
webpush.setVapidDetails(
  "mailto:lucasdocarbono@gmail.com",
  vapidKeys.publicKey,
  vapidKeys.privateKey,
);
`;

content = content.replace(target2, replacement2);
fs.writeFileSync('src/server/routes.ts', content);
console.log("Successfully replaced");

