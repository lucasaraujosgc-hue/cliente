const fs = require('fs');
let content = fs.readFileSync('src/server/db.ts', 'utf8');

const oldCode = `    // Schema updates
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
    await client.query(\`ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "fcm_token" text;\`);
    
    await client.query(\`
      CREATE TABLE IF NOT EXISTS "subscriptions" (`;

const newCode = `    
    await client.query(\`
      CREATE TABLE IF NOT EXISTS "subscriptions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "client_id" uuid NOT NULL REFERENCES "clients"("id"),
        "subscription_object" jsonb,
        "fcm_token" text,
        "device_name" text,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS "serpro_config" (
        "id" serial PRIMARY KEY,
        "usuario_id" integer NOT NULL DEFAULT 1,
        "consumer_key" text,
        "consumer_secret" text,
        "cert_path" text,
        "cert_senha" text,
        "cnpj_contratante" text,
        "ambiente" text DEFAULT 'trial',
        "updated_at" timestamp DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS "guias_geradas" (
        "id" serial PRIMARY KEY,
        "client_id" uuid NOT NULL REFERENCES "clients"("id"),
        "usuario_id" integer NOT NULL DEFAULT 1,
        "tipo_guia" text NOT NULL,
        "competencia" text NOT NULL,
        "status" text DEFAULT 'PENDENTE',
        "pdf_path" text,
        "data_vencimento" text,
        "valor_total" real,
        "numero_documento" text,
        "erro_msg" text,
        "created_at" timestamp DEFAULT now(),
        "concluido_at" timestamp
      );
      CREATE TABLE IF NOT EXISTS "scheduled_notifications" (
        "id" serial PRIMARY KEY,
        "client_id" uuid REFERENCES "clients"("id") ON DELETE CASCADE,
        "type" text NOT NULL,
        "title" text NOT NULL,
        "body" text NOT NULL,
        "schedule_day" integer,
        "schedule_time" text,
        "last_sent" timestamp,
        "active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
    \`);
    
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

    await client.query(\`
      CREATE TABLE IF NOT EXISTS "subscriptions" (`;

content = content.replace(oldCode, newCode);

const toRemove = `        "created_at" timestamp DEFAULT now() NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS "serpro_config" (
        "id" serial PRIMARY KEY,
        "usuario_id" integer NOT NULL DEFAULT 1,
        "consumer_key" text,
        "consumer_secret" text,
        "cert_path" text,
        "cert_senha" text,
        "cnpj_contratante" text,
        "ambiente" text DEFAULT 'trial',
        "updated_at" timestamp DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS "guias_geradas" (
        "id" serial PRIMARY KEY,
        "client_id" uuid NOT NULL REFERENCES "clients"("id"),
        "usuario_id" integer NOT NULL DEFAULT 1,
        "tipo_guia" text NOT NULL,
        "competencia" text NOT NULL,
        "status" text DEFAULT 'PENDENTE',
        "pdf_path" text,
        "data_vencimento" text,
        "valor_total" real,
        "numero_documento" text,
        "erro_msg" text,
        "created_at" timestamp DEFAULT now(),
        "concluido_at" timestamp
      );
      CREATE TABLE IF NOT EXISTS "scheduled_notifications" (
        "id" serial PRIMARY KEY,
        "client_id" uuid REFERENCES "clients"("id") ON DELETE CASCADE,
        "type" text NOT NULL,
        "title" text NOT NULL,
        "body" text NOT NULL,
        "schedule_day" integer,
        "schedule_time" text,
        "last_sent" timestamp,
        "active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
    \`);`;

const parts = content.split(toRemove);
if (parts.length > 1) {
  // It matched! Keep the first part and the second part. We only remove the duplicate CREATE TABLEs
  content = parts[0] + `        "created_at" timestamp DEFAULT now() NOT NULL
      );
    \`);` + parts[1];
}

fs.writeFileSync('src/server/db.ts', content);
console.log("Patch complete");
