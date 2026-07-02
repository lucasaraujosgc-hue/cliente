const fs = require('fs');
const content = fs.readFileSync('src/pages/client/Vault.tsx', 'utf8');

const target = `const StatusBadge = ({ status }: { status: Document['status'] }) => {`;
const replacement = `const StatusBadge = ({ status }: { status: 'PENDING' | 'DONE' | 'APPROVED' | 'OVERDUE' }) => {`;

if (content.includes(target)) {
  fs.writeFileSync('src/pages/client/Vault.tsx', content.replace(target, replacement));
  console.log("Successfully replaced React namespace issue");
} else {
  const content2 = content.replace("export const Vault = ({ user }: { user: any }) => {", "export const Vault = () => {");
  if(content !== content2) {
      fs.writeFileSync('src/pages/client/Vault.tsx', content2);
      console.log("Replaced user any");
  } else {
      console.log("Target not found");
  }
}
