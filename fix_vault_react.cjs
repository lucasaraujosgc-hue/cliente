const fs = require('fs');
const content = fs.readFileSync('src/pages/client/Vault.tsx', 'utf8');

const target = `export function ClientVault() {
  const handleOpenExternal = async (url: string | undefined, e: React.MouseEvent) => {`;
const replacement = `import React from "react";
export function ClientVault() {
  const handleOpenExternal = async (url: string | undefined, e: React.MouseEvent) => {`;

if (content.includes(target)) {
  fs.writeFileSync('src/pages/client/Vault.tsx', content.replace(target, replacement));
  console.log("Successfully replaced React namespace issue");
} else {
  console.log("Target not found");
}
