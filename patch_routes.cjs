const fs = require('fs');
let content = fs.readFileSync('src/server/routes.ts', 'utf8');

// Replace the require block
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

const replacement = `
const vapidPath = '.vapid.json';
// We will move the generation logic to a helper function that is called AFTER fs is imported!
`;

content = content.replace(target, replacement);

const target2 = `import { eq, desc, asc, inArray, or } from "drizzle-orm";
import fs from "fs";
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY || "re_123");
import https from "https";
import path from "path";`;

const replacement2 = `import { eq, desc, asc, inArray, or } from "drizzle-orm";
import fs from "fs";
import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY || "re_123");
import https from "https";
import path from "path";

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

// Remove the old setVapidDetails if it exists before target2
const oldSetVapid = `webpush.setVapidDetails(
  "mailto:lucasdocarbono@gmail.com",
  vapidKeys.publicKey,
  vapidKeys.privateKey,
);`;
content = content.replace(oldSetVapid, '');


fs.writeFileSync('src/server/routes.ts', content);
console.log("Successfully replaced");

