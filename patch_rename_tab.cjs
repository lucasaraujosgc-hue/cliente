const fs = require('fs');
let content = fs.readFileSync('src/pages/accountant/Notifications.tsx', 'utf8');

content = content.replace(/> Envio Imediato/g, '> Notificações Push');
content = content.replace(/TAB 1: ENVIO IMEDIATO/g, 'TAB 1: NOTIFICAÇÕES PUSH');

fs.writeFileSync('src/pages/accountant/Notifications.tsx', content);
console.log("Renamed tab to Notificações Push");
