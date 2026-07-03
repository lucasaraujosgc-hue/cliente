const fs = require('fs');
let content = fs.readFileSync('src/server/db.ts', 'utf8');

const target = `export async function initDb() {
  const client = await pool.connect();
  try {`;
const replacement = `export async function initDb() {
  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    console.error("Failed to connect to the database. Is DATABASE_URL set?", err.message);
    return;
  }
  try {`;

content = content.replace(target, replacement);
fs.writeFileSync('src/server/db.ts', content);
console.log("Patched initDb");
