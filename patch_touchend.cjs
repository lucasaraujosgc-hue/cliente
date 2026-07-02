const fs = require('fs');
const content = fs.readFileSync('src/pages/client/Dashboard.tsx', 'utf8');

const target1 = `          // We intercept the very first tap anywhere on the screen to trigger the native prompt!
          const handleFirstClick = () => {
            if (Notification.permission === "default") {
              handleRequestPushPermission(true);
            }
            document.removeEventListener('click', handleFirstClick, true);
          };
          document.addEventListener('click', handleFirstClick, true);`;

const replacement1 = `          // We intercept the very first tap anywhere on the screen to trigger the native prompt!
          const handleFirstClick = () => {
            if (Notification.permission === "default") {
              handleRequestPushPermission(true);
            }
            document.removeEventListener('click', handleFirstClick, true);
            document.removeEventListener('touchend', handleFirstClick, true);
          };
          document.addEventListener('click', handleFirstClick, true);
          document.addEventListener('touchend', handleFirstClick, true);`;

let newContent = content;
if (newContent.includes(target1)) {
  newContent = newContent.replace(target1, replacement1);
  fs.writeFileSync('src/pages/client/Dashboard.tsx', newContent);
  console.log("Successfully replaced");
} else {
  console.log("Target not found");
}
