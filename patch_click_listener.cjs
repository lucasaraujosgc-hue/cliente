const fs = require('fs');
const content = fs.readFileSync('src/pages/client/Dashboard.tsx', 'utf8');

const target1 = `  useEffect(() => {
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

const replacement1 = `  useEffect(() => {
    loadData();
    checkPushPermission();
    
    // Automatically try to request native push notification permissions if possible
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        const isCapacitor = typeof window !== "undefined" && (window as any).Capacitor !== undefined;
        if (!isCapacitor) {
          // Add a tiny delay for browsers that allow auto-prompt (Android/Chrome)
          setTimeout(() => {
            handleRequestPushPermission(true);
          }, 1000);
          
          // For Safari (iOS/macOS), a user gesture is required to show the native prompt.
          // We intercept the very first tap anywhere on the screen to trigger the native prompt!
          const handleFirstClick = () => {
            if (Notification.permission === "default") {
              handleRequestPushPermission(true);
            }
            document.removeEventListener('click', handleFirstClick, true);
          };
          document.addEventListener('click', handleFirstClick, true);
          
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
  fs.writeFileSync('src/pages/client/Dashboard.tsx', newContent);
  console.log("Successfully replaced");
} else {
  console.log("Target not found");
}
