import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type { Client, Document, BillingData, Message } from "./types";

const DB_FILE = path.join(process.cwd(), "db.json");

interface DatabaseSchema {
  clients: Client[];
  documents: Document[];
  billing: BillingData[];
  messages: Message[];
}

const defaultDB: DatabaseSchema = {
  clients: [
    {
      id: "client-1",
      cnpj: "12.345.678/0001-99",
      name: "Empresa XPTO Ltda",
      passwordHash: "12.345.678/0001-99", // First login is the CNPJ
      regularityStatus: "warning",
      firstAccessDone: false,
    },
    {
      id: "client-2",
      cnpj: "98.765.432/0001-11",
      name: "Startup Inovadora S/A",
      passwordHash: "98.765.432/0001-11",
      regularityStatus: "green",
      firstAccessDone: false,
    }
  ],
  documents: [
    {
      id: "doc-1",
      clientId: "client-1",
      title: "Guia DAS (Simples Nacional)",
      category: "taxes",
      dueDate: "2026-06-20",
      status: "pending",
      uploadedBy: "accountant",
      createdAt: "2026-06-01T10:00:00Z",
    },
    {
      id: "doc-2",
      clientId: "client-1",
      title: "Contrato Social v2",
      category: "company",
      status: "viewed",
      uploadedBy: "accountant",
      createdAt: "2023-01-15T14:30:00Z",
    }
  ],
  billing: [
    { id: "bill-1", clientId: "client-1", month: "2026-01", revenue: 50000, expenses: 15000, payroll: 20000 },
    { id: "bill-2", clientId: "client-1", month: "2026-02", revenue: 55000, expenses: 14000, payroll: 20000 },
    { id: "bill-3", clientId: "client-1", month: "2026-03", revenue: 48000, expenses: 16000, payroll: 20000 },
    { id: "bill-4", clientId: "client-1", month: "2026-04", revenue: 60000, expenses: 15000, payroll: 22000 },
    { id: "bill-5", clientId: "client-1", month: "2026-05", revenue: 65000, expenses: 18000, payroll: 22000 },
  ],
  messages: [
    {
      id: "msg-1",
      clientId: "client-1",
      content: "Lembrete: fechamento da folha até dia 05, enviar recibos pendentes.",
      createdAt: "2026-06-02T09:00:00Z",
      read: false,
    }
  ]
};

let dbCache: DatabaseSchema | null = null;

function loadDB(): DatabaseSchema {
  if (dbCache) return dbCache;
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDB, null, 2));
    dbCache = { ...defaultDB };
  } else {
    try {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      dbCache = JSON.parse(data);
    } catch {
      dbCache = { ...defaultDB };
    }
  }
  return dbCache!;
}

function saveDB(db: DatabaseSchema) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  dbCache = db;
}

export const db = {
  get db() {
    return loadDB();
  },
  save() {
    if (dbCache) saveDB(dbCache);
  }
};
