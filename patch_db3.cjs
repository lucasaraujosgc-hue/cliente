const fs = require('fs');
let content = fs.readFileSync('src/server/db.ts', 'utf8');

// We just want to remove the first block of alters.
// We can find the index of "    // Schema updates" and the index of "        await client.query(`\n      CREATE TABLE IF NOT EXISTS \"subscriptions\""
const startStr = "    // Schema updates\n";
const endStr = "        await client.query(`\n      CREATE TABLE IF NOT EXISTS \"subscriptions\"";

const startIdx = content.indexOf(startStr);
const endIdx = content.indexOf(endStr);

if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
  content = content.substring(0, startIdx) + content.substring(endIdx);
  fs.writeFileSync('src/server/db.ts', content);
  console.log("Removed bad block");
} else {
  console.log("Could not find block");
}
