const fs = require('fs');
let content = fs.readFileSync('src/pages/client/Dashboard.tsx', 'utf8');

const target = `{pushPermission === "default" && !pushDismissed && typeof window !== "undefined" && "Notification" in window && !((window as any).Capacitor !== undefined) && (`;
const replacement = `{pushPermission === "default" && !pushDismissed && typeof window !== "undefined" && !((window as any).Capacitor !== undefined) && (`;

content = content.replace(target, replacement);

fs.writeFileSync('src/pages/client/Dashboard.tsx', content);
console.log("Modal patched again");
