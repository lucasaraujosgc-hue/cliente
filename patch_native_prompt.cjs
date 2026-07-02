const fs = require('fs');
const content = fs.readFileSync('src/pages/client/Dashboard.tsx', 'utf8');

const target1 = `  useEffect(() => {
    loadData();
    checkPushPermission();
    subscribeToPush();
  }, []);`;

const replacement1 = `  useEffect(() => {
    loadData();
    checkPushPermission();
    
    // Automatically try to request native push notification permissions if possible
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        const isCapacitor = typeof window !== "undefined" && (window as any).Capacitor !== undefined;
        if (!isCapacitor) {
          // Add a tiny delay to allow the app to paint before the native prompt blocks
          setTimeout(() => {
            handleRequestPushPermission(true);
          }, 1000);
        } else {
          subscribeToPush();
        }
      } else {
         subscribeToPush();
      }
    } else {
      subscribeToPush();
    }
  }, []);`;

let newContent = content;
if (newContent.includes(target1)) {
  newContent = newContent.replace(target1, replacement1);
}

const startIdx = newContent.indexOf('{/* 🔔 PUSH NOTIFICATION MODAL (BLOCKING) */}');
if (startIdx !== -1) {
  const endIdxStr = '</div>\n        </div>\n      )}';
  const endIdx = newContent.indexOf(endIdxStr, startIdx) + endIdxStr.length;
  if (endIdx !== -1) {
    newContent = newContent.substring(0, startIdx) + newContent.substring(endIdx);
  }
}

fs.writeFileSync('src/pages/client/Dashboard.tsx', newContent);
console.log("Replaced");
