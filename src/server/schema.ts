import { pgTable, text, timestamp, boolean, integer, uuid, json } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  cnpj: text('cnpj').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  regularityStatus: text('regularity_status').notNull(), // green, warning, red
  email: text('email'),
  firstAccessDone: boolean('first_access_done').default(false),
  integrationHash: text('integration_hash').unique(),
  accountantCategory: text('accountant_category'),
});

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  title: text('title').notNull(),
  category: text('category').notNull(), // taxes, payroll, company, other, bank_statement
  competence: text('competence'), // "MM/YYYY" like "05/2026"
  dueDate: text('due_date'),
  status: text('status').notNull(), // pending, paid, new, viewed
  uploadedBy: text('uploaded_by').notNull(), // accountant, client
  createdAt: timestamp('created_at').defaultNow().notNull(),
  fileUrl: text('file_url'),
  pixCode: text('pix_code'),
  extractedData: json('extracted_data'),
});

export const billingData = pgTable('billing_data', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  month: text('month').notNull(), // "MM/YYYY"
  servicesRevenue: integer('services_revenue').default(0).notNull(),
  salesRevenue: integer('sales_revenue').default(0).notNull(),
  totalIncomes: integer('total_incomes').default(0).notNull(),
  servicesTaken: integer('services_taken').default(0).notNull(),
  // Keeping old fields just in case or we can just replace them entirely.
  // Actually replacing them entirely is better but we might have seed data.
  revenue: integer('revenue').default(0).notNull(),
  expenses: integer('expenses').default(0).notNull(),
  payroll: integer('payroll').default(0).notNull(),
});

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  read: boolean('read').default(false).notNull(),
});

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id).notNull(),
  subscriptionObject: json('subscription_object').notNull(),
  deviceName: text('device_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const clientsRelations = relations(clients, ({ many }) => ({
	documents: many(documents),
	billingData: many(billingData),
	messages: many(messages),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
	client: one(clients, {
		fields: [documents.clientId],
		references: [clients.id],
	}),
}));

export const billingDataRelations = relations(billingData, ({ one }) => ({
	client: one(clients, {
		fields: [billingData.clientId],
		references: [clients.id],
	}),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
	client: one(clients, {
		fields: [messages.clientId],
		references: [clients.id],
	}),
}));
