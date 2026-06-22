import { Express, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { db } from "./db";
import { clients, documents, billingData, messages } from "./schema";
import { eq, desc, asc } from "drizzle-orm";

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
async function verifyIntegrationToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid token" });
  }
  const token = authHeader.split(" ")[1];
  
  const clientList = await db.select().from(clients).where(eq(clients.integrationHash, token));
  if (clientList.length === 0) {
    return res.status(403).json({ error: "Invalid integration token" });
  }
  
  // Attach client to request
  (req as any).integrationClient = clientList[0];
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
  app.post("/api/auth/client/login", async (req, res) => {
    const { cnpj, password } = req.body;
    
    // Check if it's the admin
    const adminUser = String(process.env.ADMIN || "admin").trim();
    const adminPass = String(process.env.PASSWORD || "admin_password").trim();
    
    const inputUserNum = String(cnpj).replace(/\D/g, "");
    const adminUserNum = adminUser.replace(/\D/g, "");
    
    const userMatch = (String(cnpj) === adminUser) || (adminUserNum.length > 0 && adminUserNum === inputUserNum);
    if (userMatch && String(password).trim() === adminPass) {
      const token = jwt.sign({ role: "accountant", name: "Contador" }, JWT_SECRET, { expiresIn: "30d" });
      return res.json({ token, role: "accountant", user: { name: "Contador" } });
    }

    const cleanCnpj = String(cnpj).replace(/\D/g, "");
    
    const clientList = await db.select().from(clients);
    const client = clientList.find(c => {
      const dbCnpj = String(c.cnpj).replace(/\D/g, "");
      const dbPassStr = String(c.passwordHash);
      const inputPassStr = String(password);
      
      const passMatches = dbPassStr === inputPassStr || dbPassStr.replace(/\D/g, "") === inputPassStr.replace(/\D/g, "");
      return dbCnpj === cleanCnpj && passMatches;
    });
    
    if (!client) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }
    const token = jwt.sign({ clientId: client.id, role: "client", name: client.name }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, role: "client", client: { id: client.id, name: client.name, cnpj: client.cnpj, firstAccessDone: client.firstAccessDone } });
  });

  // Accountant Login
  app.post("/api/auth/accountant/login", (req, res) => {
    const { username, password } = req.body;
    
    const adminUser = String(process.env.ADMIN || "admin").trim();
    const adminPass = String(process.env.PASSWORD || "admin_password").trim();
    
    const inputUserNum = String(username).replace(/\D/g, "");
    const adminUserNum = adminUser.replace(/\D/g, "");
    const userMatch = (username === adminUser) || (adminUserNum.length > 0 && adminUserNum === inputUserNum);
    
    if (userMatch && String(password).trim() === adminPass) {
      const token = jwt.sign({ role: "accountant", name: "Contador" }, JWT_SECRET, { expiresIn: "30d" });
      return res.json({ token, user: { name: "Contador" } });
    }
    res.status(401).json({ error: "Credenciais inválidas" });
  });

  // -------------------------------------------------------------
  // INTEGRATION ENGINE (API EXTERNA via Hash)
  // -------------------------------------------------------------
  
  // Upload doc via API
  app.post("/api/integration/upload-doc", verifyIntegrationToken, async (req, res) => {
    const client = (req as any).integrationClient;
    const { title, category, dueDate } = req.body;
    
    const [newDoc] = await db.insert(documents).values({
      clientId: client.id,
      title,
      category,
      dueDate,
      status: "new",
      uploadedBy: "accountant",
    }).returning();

    res.json({ success: true, document: { ...newDoc, createdAt: newDoc.createdAt.toISOString() } });
  });

  // Sync client (update or create)
  app.post("/api/integration/sync-client", verifyIntegrationToken, async (req, res) => {
    const { cnpj, name, regularityStatus } = req.body;
    const clientList = await db.select().from(clients).where(eq(clients.cnpj, cnpj));
    let client;
    if (clientList.length === 0) {
      [client] = await db.insert(clients).values({
        cnpj,
        name,
        passwordHash: cnpj.replace(/[^0-9]/g, "").slice(0, 6),
        regularityStatus: regularityStatus || "green",
      }).returning();
    } else {
      [client] = await db.update(clients).set({
        name: name || clientList[0].name,
        regularityStatus: regularityStatus || clientList[0].regularityStatus
      }).where(eq(clients.cnpj, cnpj)).returning();
    }
    res.json({ success: true, client });
  });

  // Update Billing
  app.post("/api/integration/update-billing", verifyIntegrationToken, async (req, res) => {
    const { clientId, month, revenue, expenses, payroll } = req.body;
    
    const existing = await db.select().from(billingData).where(eq(billingData.clientId, clientId));
    const target = existing.find(b => b.month === month);
    
    if (target) {
      await db.update(billingData).set({
        revenue,
        expenses,
        payroll
      }).where(eq(billingData.id, target.id));
    } else {
      await db.insert(billingData).values({
        clientId,
        month,
        revenue,
        expenses,
        payroll
      });
    }
    res.json({ success: true });
  });

  // -------------------------------------------------------------
  // CLIENT VIEW ENDPOINTS
  // -------------------------------------------------------------

  app.get("/api/client/dashboard", verifyClientAuth, async (req, res) => {
    const clientId = (req as any).user.clientId;
    const clientList = await db.select().from(clients).where(eq(clients.id, clientId));
    if (clientList.length === 0) return res.status(404).json({ error: "Client not found" });

    const client = clientList[0];
    const docs = await db.select().from(documents).where(eq(documents.clientId, clientId));
    const billing = await db.select().from(billingData).where(eq(billingData.clientId, clientId)).orderBy(asc(billingData.month));
    const msgs = await db.select().from(messages).where(eq(messages.clientId, clientId)).orderBy(desc(messages.createdAt));

    res.json({
      client,
      documents: docs.map(d => ({ ...d, createdAt: d.createdAt.toISOString() })),
      billing,
      messages: msgs.map(m => ({ ...m, createdAt: m.createdAt.toISOString() }))
    });
  });

  app.post("/api/client/setup-profile", verifyClientAuth, async (req, res) => {
    const clientId = (req as any).user.clientId;
    const { email, password } = req.body;
    
    const clientList = await db.select().from(clients).where(eq(clients.id, clientId));
    if (clientList.length === 0) return res.status(404).json({ error: "Client not found" });

    const updateData: any = {
      email,
      firstAccessDone: true
    };
    if (password) {
      updateData.passwordHash = password;
    }
    
    const [client] = await db.update(clients).set(updateData).where(eq(clients.id, clientId)).returning();

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
      }
    }

    res.json({ success: true, client });
  });

  // Upload file by client
  app.post("/api/client/upload", verifyClientAuth, async (req, res) => {
    const clientId = (req as any).user.clientId;
    const { title, category, competence } = req.body;
    
    const [newDoc] = await db.insert(documents).values({
      clientId,
      title: title || `Documento ${category}`,
      category,
      competence,
      status: "new",
      uploadedBy: "client",
    }).returning();
    
    res.json({ success: true, document: { ...newDoc, createdAt: newDoc.createdAt.toISOString() } });
  });

  app.post("/api/client/mark-doc/:id", verifyClientAuth, async (req, res) => {
    const clientId = (req as any).user.clientId;
    const docId = req.params.id;
    const { status } = req.body;
    
    const docs = await db.select().from(documents).where(eq(documents.id, docId));
    if (docs.length > 0 && docs[0].clientId === clientId) {
      await db.update(documents).set({ status }).where(eq(documents.id, docId));
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Doc not found" });
    }
  });

  // -------------------------------------------------------------
  // ACCOUNTANT VIEW ENDPOINTS
  // -------------------------------------------------------------
  
  app.get("/api/accountant/clients", verifyAccountantAuth, async (req, res) => {
    const allClients = await db.select().from(clients);
    res.json({ clients: allClients });
  });

  app.get("/api/accountant/client/:id", verifyAccountantAuth, async (req, res) => {
    const clientId = req.params.id;
    const clientList = await db.select().from(clients).where(eq(clients.id, clientId));
    if (clientList.length === 0) return res.status(404).json({ error: "Client not found" });

    const client = clientList[0];
    const docs = await db.select().from(documents).where(eq(documents.clientId, clientId));
    const msgs = await db.select().from(messages).where(eq(messages.clientId, clientId));
    const billing = await db.select().from(billingData).where(eq(billingData.clientId, clientId));

    res.json({ 
      client, 
      documents: docs.map(d => ({ ...d, createdAt: d.createdAt.toISOString() })), 
      messages: msgs.map(m => ({ ...m, createdAt: m.createdAt.toISOString() })), 
      billing 
    });
  });

  app.get("/api/accountant/inbox", verifyAccountantAuth, async (req, res) => {
    const allDocs = await db.select().from(documents).where(eq(documents.uploadedBy, "client")).orderBy(desc(documents.createdAt));
    const allClients = await db.select().from(clients);
    
    const inboxDocs = allDocs.map(doc => {
       const cl = allClients.find(c => c.id === doc.clientId);
       return { ...doc, createdAt: doc.createdAt.toISOString(), clientName: cl?.name || "Desconhecido" };
    });
    
    res.json({ docs: inboxDocs });
  });

  app.post("/api/accountant/upload-doc", verifyAccountantAuth, async (req, res) => {
    const { clientId, title, category, dueDate } = req.body;
    
    const [newDoc] = await db.insert(documents).values({
      clientId,
      title,
      category,
      dueDate,
      status: "new",
      uploadedBy: "accountant"
    }).returning();

    res.json({ success: true, document: { ...newDoc, createdAt: newDoc.createdAt.toISOString() } });
  });

  app.post("/api/accountant/message", verifyAccountantAuth, async (req, res) => {
    const { clientId, content } = req.body;
    
    await db.insert(messages).values({
      clientId,
      content,
      read: false
    });
    
    res.json({ success: true });
  });
  
  app.post("/api/accountant/client/:id/generate-token", verifyAccountantAuth, async (req, res) => {
     const clientId = req.params.id;
     const clientList = await db.select().from(clients).where(eq(clients.id, clientId));
     if (clientList.length === 0) return res.status(404).json({ error: "Client not found" });

     const newToken = "hash_" + uuidv4().replace(/-/g,"");
     await db.update(clients).set({ integrationHash: newToken }).where(eq(clients.id, clientId));
     
     res.json({ token: newToken });
  });

  app.post("/api/accountant/client/:id/revoke-token", verifyAccountantAuth, async (req, res) => {
     const clientId = req.params.id;
     const clientList = await db.select().from(clients).where(eq(clients.id, clientId));
     if (clientList.length === 0) return res.status(404).json({ error: "Client not found" });

     await db.update(clients).set({ integrationHash: null }).where(eq(clients.id, clientId));
     
     res.json({ success: true });
  });
}
