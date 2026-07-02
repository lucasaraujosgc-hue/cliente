const fs = require('fs');
const content = fs.readFileSync('src/pages/client/Dashboard.tsx', 'utf8');

const target = `    } catch (e) {
      console.error("Failed to subscribe to push notifications", e);
      if (!isCapacitor) {
        alert("Erro ao se inscrever nas notificações. Verifique se o navegador suporta Web Push.");
      }`;

const replacement = `    } catch (e) {
      console.error("Failed to subscribe to push notifications", e);
      const isCapacitor = typeof window !== "undefined" && (window as any).Capacitor !== undefined;
      if (!isCapacitor) {
        alert("Erro ao se inscrever nas notificações. Verifique se o navegador suporta Web Push.");
      }`;

if (content.includes(target)) {
  fs.writeFileSync('src/pages/client/Dashboard.tsx', content.replace(target, replacement));
  console.log("Successfully replaced isCapacitor");
} else {
  console.log("Target not found");
}
