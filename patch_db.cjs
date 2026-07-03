const fs = require('fs');
let content = fs.readFileSync('src/server/db.ts', 'utf8');

const target = `    // Schema updates
    await client.query(\`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "accountant_category" text;\`);
    await client.query(\`ALTER TABLE "billing_data" ADD COLUMN IF NOT EXISTS "services_revenue" integer DEFAULT 0 NOT NULL;\`);
    await client.query(\`ALTER TABLE "billing_data" ADD COLUMN IF NOT EXISTS "sales_revenue" integer DEFAULT 0 NOT NULL;\`);
    await client.query(\`ALTER TABLE "billing_data" ADD COLUMN IF NOT EXISTS "total_incomes" integer DEFAULT 0 NOT NULL;\`);
    await client.query(\`ALTER TABLE "billing_data" ADD COLUMN IF NOT EXISTS "services_taken" integer DEFAULT 0 NOT NULL;\`);
    await client.query(\`ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "competence" text;\`);
    await client.query(\`ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "pix_code" text;\`);
    await client.query(\`ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "extracted_data" jsonb;\`);
    await client.query(\`ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "direction" text DEFAULT 'accountant_to_client' NOT NULL;\`);
    await client.query(\`ALTER TABLE "scheduled_notifications" ADD COLUMN IF NOT EXISTS "schedule_time" text;\`);
    await client.query(\`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "notification_preferences" json DEFAULT '{"receives_all":true,"recurrent":true,"before_due":true,"on_due":true,"on_new_file":true}'::json;\`);
    await client.query(\`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "reset_token" text;\`);
    await client.query(\`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "reset_token_expires" text;\`);
    await client.query(\`ALTER TABLE "serpro_config" ADD COLUMN IF NOT EXISTS "whatsapp_support" text;\`);
    await client.query(\`ALTER TABLE "subscriptions" ALTER COLUMN "subscription_object" DROP NOT NULL;\`);
    await client.query(\`ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "fcm_token" text;\`);`;

const replacement = `    // We will do ALTERs after CREATE TABLEs below...`;

content = content.replace(target, replacement);

const target2 = `    // Remove test companies`;
const replacement2 = `
    // Schema updates (now safe to run after CREATE TABLE)
    try { await client.query(\`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "accountant_category" text;\`); } catch(e) {}
    try { await client.query(\`ALTER TABLE "billing_data" ADD COLUMN IF NOT EXISTS "services_revenue" integer DEFAULT 0 NOT NULL;\`); } catch(e) {}
    try { await client.query(\`ALTER TABLE "billing_data" ADD COLUMN IF NOT EXISTS "sales_revenue" integer DEFAULT 0 NOT NULL;\`); } catch(e) {}
    try { await client.query(\`ALTER TABLE "billing_data" ADD COLUMN IF NOT EXISTS "total_incomes" integer DEFAULT 0 NOT NULL;\`); } catch(e) {}
    try { await client.query(\`ALTER TABLE "billing_data" ADD COLUMN IF NOT EXISTS "services_taken" integer DEFAULT 0 NOT NULL;\`); } catch(e) {}
    try { await client.query(\`ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "competence" text;\`); } catch(e) {}
    try { await client.query(\`ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "pix_code" text;\`); } catch(e) {}
    try { await client.query(\`ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "extracted_data" jsonb;\`); } catch(e) {}
    try { await client.query(\`ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "direction" text DEFAULT 'accountant_to_client' NOT NULL;\`); } catch(e) {}
    try { await client.query(\`ALTER TABLE "scheduled_notifications" ADD COLUMN IF NOT EXISTS "schedule_time" text;\`); } catch(e) {}
    try { await client.query(\`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "notification_preferences" json DEFAULT '{"receives_all":true,"recurrent":true,"before_due":true,"on_due":true,"on_new_file":true}'::json;\`); } catch(e) {}
    try { await client.query(\`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "reset_token" text;\`); } catch(e) {}
    try { await client.query(\`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "reset_token_expires" text;\`); } catch(e) {}
    try { await client.query(\`ALTER TABLE "serpro_config" ADD COLUMN IF NOT EXISTS "whatsapp_support" text;\`); } catch(e) {}
    try { await client.query(\`ALTER TABLE "subscriptions" ALTER COLUMN "subscription_object" DROP NOT NULL;\`); } catch(e) {}
    try { await client.query(\`ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "fcm_token" text;\`); } catch(e) {}

    // Remove test companies`;

content = content.replace(target2, replacement2);

fs.writeFileSync('src/server/db.ts', content);
console.log("DB init script patched successfully!");
