const fs = require('fs');
let content = fs.readFileSync('src/pages/client/Dashboard.tsx', 'utf8');

const effect = `
  useEffect(() => {
    // Auto-subscribe if already granted, or if using Capacitor (which handles it differently)
    if (typeof window !== "undefined") {
      const isCapacitor = (window as any).Capacitor !== undefined;
      if (isCapacitor) {
        handleRequestPushPermission(true);
      } else if ("Notification" in window && Notification.permission === "granted") {
        handleRequestPushPermission(true);
      }
    }
  }, []);
`;

// Insert after the existing useEffect
const target = `  useEffect(() => {
    const handleOpenNotif = () => setShowPrefsModal(true);
    window.addEventListener('open-notifications', handleOpenNotif);
    return () => window.removeEventListener('open-notifications', handleOpenNotif);
  }, []);`;

content = content.replace(target, target + effect);

fs.writeFileSync('src/pages/client/Dashboard.tsx', content);
console.log("Auto-push patched");
