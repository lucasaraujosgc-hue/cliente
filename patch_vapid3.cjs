const fs = require('fs');
const content = fs.readFileSync('src/server/routes.ts', 'utf8');

const target = `const fsModule = require('fs');
const vapidPath = '.vapid.json';
if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
  try {
    if (fsModule.existsSync(vapidPath)) {
      vapidKeys = JSON.parse(fsModule.readFileSync(vapidPath, 'utf-8'));
    } else {
      vapidKeys = webpush.generateVAPIDKeys();
      fsModule.writeFileSync(vapidPath, JSON.stringify(vapidKeys, null, 2));
      console.log("Generated and saved new VAPID keys to .vapid.json");
    }
  } catch (e) {
    console.error("Error reading/writing VAPID keys", e);
    vapidKeys = webpush.generateVAPIDKeys();
  }
}`;

const replacement = `const vapidPath = '.vapid.json';
if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
  try {
    // using fs dynamically to avoid hoisting issues, but fs is imported below
    // Actually we can just use dynamic import for fs in top level if needed, but since it's top level async isn't easy
    // Let's just mock it with process.cwd() checking or let it fail gracefully if fs is not yet available, wait...
    // Actually, fs is imported at line 68. Let's move fs and path imports UP.
  } catch(e) {}
}`;

// Wait, moving imports is better!
