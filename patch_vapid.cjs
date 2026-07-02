const fs = require('fs');
const content = fs.readFileSync('src/server/routes.ts', 'utf8');

const target = `let vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || "",
  privateKey: process.env.VAPID_PRIVATE_KEY || "",
};

if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
  vapidKeys = webpush.generateVAPIDKeys();
  console.log(
    "Generated new VAPID keys for this session (they won't persist after restart):",
  );
  console.log("Public Key:", vapidKeys.publicKey);
  console.log("Private Key:", vapidKeys.privateKey);
}`;

const replacement = `let vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || "",
  privateKey: process.env.VAPID_PRIVATE_KEY || "",
};

const vapidPath = path.resolve(process.cwd(), '.vapid.json');
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
}`;

if (content.includes(target)) {
  fs.writeFileSync('src/server/routes.ts', content.replace(target, replacement));
  console.log("Successfully replaced");
} else {
  console.log("Target not found");
}
