import { Express, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { db } from "./db";
import type { Client, Document, BillingData, Message } from "./types";

const JWT_SECRET = crypto.randomBytes(32).toString("hex");

// Email Transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.hostinger.com",
  port: parseInt(process.env.EMAIL_PORT || "587"),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Middlewares
function verifyIntegrationToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }
  const token = authHeader.split(" ")[1];
  
  const client = db.db.clients.find(c => c.integrationHash === token);
  if (!client) {
    return res.status(403).json({ error: "Invalid integration token" });
  }
  
  // Attach client to request
  (req as any).integrationClient = client;
  next();
}

function verifyClientAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.role !== "client") throw new Error("Invalid role");
    
    // Attach to request
    (req as any).user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function verifyAccountantAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.role !== "accountant") throw new Error("Invalid role");
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function setupRoutes(app: Express) {
  // -------------------------------------------------------------
  // AUTH
  // -------------------------------------------------------------
  
  // Client Login
  app.post("/api/auth/client/login", (req, res) => {
    const { cnpj, password } = req.body;
    const cleanCnpj = cnpj.replace(/\D/g, "");
    
    const client = db.db.clients.find(c => c.cnpj.replace(/\D/g, "") === cleanCnpj && c.passwordHash === password);
    if (!client) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }
    const token = jwt.sign({ clientId: client.id, role: "client", name: client.name }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, client: { id: client.id, name: client.name, cnpj: client.cnpj, firstAccessDone: client.firstAccessDone } });
  });

  // Accountant Login
  app.post("/api/auth/accountant/login", (req, res) => {
    const { username, password } = req.body;
    
    const adminUser = process.env.ADMIN || "admin";
    const adminPass = process.env.PASSWORD || "admin";
    
    if (username === adminUser && password === adminPass) {
      const token = jwt.sign({ role: "accountant", name: "Contador" }, JWT_SECRET, { expiresIn: "30d" });
      return res.json({ token, user: { name: "Contador" } });
    }
    res.status(401).json({ error: "Credenciais inválidas" });
  });

  // -------------------------------------------------------------
  // INTEGRATION ENGINE (API EXTERNA via Hash)
  // -------------------------------------------------------------
  
  // Upload doc via API
  app.post("/api/integration/upload-doc", verifyIntegrationToken, (req, res) => {
    const client = (req as any).integrationClient;
    const { title, category, dueDate } = req.body;
    const newDoc: Document = {
      id: uuidv4(),
      clientId: client.id,
      title,
      category,
      dueDate,
      status: "new",
      uploadedBy: "accountant",
      createdAt: new Date().toISOString(),
    };
    db.db.documents.push(newDoc);
    db.save();
    res.json({ success: true, document: newDoc });
  });

  // Sync client (update or create)
  app.post("/api/integration/sync-client", verifyIntegrationToken, (req, res) => {
    const { cnpj, name, regularityStatus } = req.body;
    let client = db.db.clients.find(c => c.cnpj === cnpj);
    if (!client) {
      client = {
        id: uuidv4(),
        cnpj,
        name,
        passwordHash: cnpj.replace(/[^0-9]/g, "").slice(0, 6), // Generate password as first 6 digits of CNPJ
        regularityStatus: regularityStatus || "green",
      };
      db.db.clients.push(client);
    } else {
      if (name) client.name = name;
      if (regularityStatus) client.regularityStatus = regularityStatus;
    }
    db.save();
    res.json({ success: true, client });
  });

  // Update Billing
  app.post("/api/integration/update-billing", verifyIntegrationToken, (req, res) => {
    const { clientId, month, revenue, expenses, payroll } = req.body;
    const existing = db.db.billing.find(b => b.clientId === clientId && b.month === month);
    if (existing) {
      existing.revenue = revenue;
      existing.expenses = expenses;
      existing.payroll = payroll;
    } else {
      db.db.billing.push({
        id: uuidv4(),
        clientId,
        month,
        revenue,
        expenses,
        payroll
      });
    }
    db.save();
    res.json({ success: true });
  });

  // -------------------------------------------------------------
  // CLIENT VIEW ENDPOINTS
  // -------------------------------------------------------------

  app.get("/api/client/dashboard", verifyClientAuth, (req, res) => {
    const clientId = (req as any).user.clientId;
    const client = db.db.clients.find(c => c.id === clientId);
    if (!client) return res.status(404).json({ error: "Client not found" });

    const documents = db.db.documents.filter(d => d.clientId === clientId);
    const billing = db.db.billing.filter(b => b.clientId === clientId).sort((a,b) => a.month.localeCompare(b.month));
    const messages = db.db.messages.filter(m => m.clientId === clientId).sort((a,b) => b.createdAt.localeCompare(a.createdAt));

    res.json({
      client,
      documents,
      billing,
      messages
    });
  });

  app.post("/api/client/setup-profile", verifyClientAuth, async (req, res) => {
    const clientId = (req as any).user.clientId;
    const { email, password } = req.body;
    
    const client = db.db.clients.find(c => c.id === clientId);
    if (!client) return res.status(404).json({ error: "Client not found" });

    client.email = email;
    if (password) {
      client.passwordHash = password;
    }
    client.firstAccessDone = true;
    db.save();

    // Send Welcome Email
    if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD && email) {
      try {
         const fromName = process.env.EMAIL_FROM_NAME || "Vírgula Contábil";
         const alias = process.env.EMAIL_ALIAS || process.env.EMAIL_USER;
         
         await transporter.sendMail({
           from: `"${fromName}" <${alias}>`,
           to: email,
           subject: "Bem-vindo(a) à Vírgula Contábil - Primeiro Acesso Confirmado",
           html: `
             <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
               <div style="background-color: #1f2937; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
                  <h1 style="color: #fff; margin: 0;">Vírgula <span style="color: #10b981;">Contábil</span></h1>
               </div>
               <h2>Olá, ${client.name}!</h2>
               <p>Seu primeiro acesso ao nosso portal foi realizado com sucesso.</p>
               <p>Seu login é: <strong>${client.cnpj}</strong></p>
               <p>Agora você pode acompanhar as guias, envios de documentos e mural de recados pelo nosso sistema centralizado.</p>
               <p>Atenciosamente,<br>Equipe Vírgula Contábil</p>
             </div>
           `
         });
      } catch (err) {
         console.error("Error sending welcome email:", err);
         // Continue even if email fails
      }
    }

    res.json({ success: true, client });
  });

  // Upload file by client
  app.post("/api/client/upload", verifyClientAuth, (req, res) => {
    const clientId = (req as any).user.clientId;
    const { title, category } = req.body;
    const newDoc: Document = {
      id: uuidv4(),
      clientId,
      title: title || `Documento ${category}`,
      category,
      status: "new",
      uploadedBy: "client",
      createdAt: new Date().toISOString()
    };
    db.db.documents.push(newDoc);
    db.save();
    res.json({ success: true, document: newDoc });
  });

  app.post("/api/client/mark-doc/:id", verifyClientAuth, (req, res) => {
    const clientId = (req as any).user.clientId;
    const docId = req.params.id;
    const { status } = req.body;
    
    const doc = db.db.documents.find(d => d.id === docId && d.clientId === clientId);
    if (doc) {
      doc.status = status;
      db.save();
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Doc not found" });
    }
  });

  // -------------------------------------------------------------
  // ACCOUNTANT VIEW ENDPOINTS
  // -------------------------------------------------------------
  
  app.get("/api/accountant/clients", verifyAccountantAuth, (req, res) => {
    res.json({ clients: db.db.clients });
  });

  app.get("/api/accountant/client/:id", verifyAccountantAuth, (req, res) => {
    const clientId = req.params.id;
    const client = db.db.clients.find(c => c.id === clientId);
    if (!client) return res.status(404).json({ error: "Client not found" });

    const documents = db.db.documents.filter(d => d.clientId === clientId);
    const messages = db.db.messages.filter(m => m.clientId === clientId);
    const billing = db.db.billing.filter(b => b.clientId === clientId);

    res.json({ client, documents, messages, billing });
  });

  app.get("/api/accountant/inbox", verifyAccountantAuth, (req, res) => {
    // get all docs uploaded by client
    const inboxDocs = db.db.documents.filter(d => d.uploadedBy === "client").map(doc => {
       const client = db.db.clients.find(c => c.id === doc.clientId);
       return { ...doc, clientName: client?.name || "Desconhecido" };
    }).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ docs: inboxDocs });
  });

  app.post("/api/accountant/upload-doc", verifyAccountantAuth, (req, res) => {
    const { clientId, title, category, dueDate } = req.body;
    const newDoc: Document = {
      id: uuidv4(),
      clientId,
      title,
      category,
      dueDate,
      status: "new",
      uploadedBy: "accountant",
      createdAt: new Date().toISOString(),
    };
    db.db.documents.push(newDoc);
    db.save();
    res.json({ success: true, document: newDoc });
  });

  app.post("/api/accountant/message", verifyAccountantAuth, (req, res) => {
    const { clientId, content } = req.body;
    const newMsg: Message = {
      id: uuidv4(),
      clientId,
      content,
      read: false,
      createdAt: new Date().toISOString()
    };
    db.db.messages.push(newMsg);
    db.save();
    res.json({ success: true });
  });
  
  app.post("/api/accountant/client/:id/generate-token", verifyAccountantAuth, (req, res) => {
     const clientId = req.params.id;
     const client = db.db.clients.find(c => c.id === clientId);
     if (!client) return res.status(404).json({ error: "Client not found" });

     const newToken = "hash_" + uuidv4().replace(/-/g,"");
     client.integrationHash = newToken;
     db.save();
     res.json({ token: newToken });
  });

  app.post("/api/accountant/client/:id/revoke-token", verifyAccountantAuth, (req, res) => {
     const clientId = req.params.id;
     const client = db.db.clients.find(c => c.id === clientId);
     if (!client) return res.status(404).json({ error: "Client not found" });

     client.integrationHash = undefined;
     db.save();
     res.json({ success: true });
  });
}
