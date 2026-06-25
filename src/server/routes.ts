import { Express, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import nodemailer from "nodemailer";
import multer from "multer";
import { db } from "./db";
import { clients, documents, billingData, messages, subscriptions, guiasGeradas, serproConfig } from "./schema";
import webpush from "web-push";

// Generate VAPID keys if they don't exist in env. For development, we can generate them on the fly if needed.
// Usually you'd store these in .env
let vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || '',
  privateKey: process.env.VAPID_PRIVATE_KEY || ''
};

if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
  vapidKeys = webpush.generateVAPIDKeys();
  console.log("Generated new VAPID keys for this session (they won't persist after restart):");
  console.log("Public Key:", vapidKeys.publicKey);
  console.log("Private Key:", vapidKeys.privateKey);
}

webpush.setVapidDetails(
  'mailto:lucasdocarbono@gmail.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);
import { eq, desc, asc, inArray } from "drizzle-orm";
import fs from "fs";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + '-' + file.originalname)
  }
})
const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB limit

const certStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dest = process.env.DATA_PATH ? path.join(process.env.DATA_PATH, "certs") : path.join(process.cwd(), "data", "certs");
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    cb(null, dest);
  },
  filename: (_req, file, cb) => cb(null, `cert_${Date.now()}_${file.originalname}`),
});
const uploadCert = multer({
  storage: certStorage,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".pfx" || ext === ".p12") cb(null, true);
    else cb(new Error("Apenas arquivos .pfx ou .p12 são aceitos."));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});
const JWT_SECRET = process.env.JWT_SECRET || "virgula-secret-key-persistent-across-deploys-12345";

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
  // Webhook for receiving files from external systems
  app.post("/api/webhook/receitas", async (req, res) => {
    try {
      const {
        hash_empresa,
        vencimento, // DD/MM/YYYY
        competencia, // MM/YYYY
        categoria,
        nome_arquivo,
        arquivo_base64,
        dados_extraidos
      } = req.body;

      if (!hash_empresa) {
        return res.status(400).json({ error: "hash_empresa is required" });
      }
      if (!arquivo_base64 && categoria !== 'SITFIS_RECEITA') {
        return res.status(400).json({ error: "arquivo_base64 is required for this category" });
      }

      // Find client
      const clientList = await db.select().from(clients).where(eq(clients.integrationHash, hash_empresa));
      if (clientList.length === 0) {
        return res.status(404).json({ error: "Client not found using provided hash" });
      }
      const client = clientList[0];

      // Save file
      let safeFilename = "";
      let pixCode = null;
      if (arquivo_base64) {
        const buffer = Buffer.from(arquivo_base64, 'base64');
        safeFilename = `${Date.now()}_${nome_arquivo || 'documento'}`;
        const filePath = path.join(UPLOADS_DIR, safeFilename);
        fs.writeFileSync(filePath, buffer);
        
        // Extract Pix Code if it's a PDF
        if (safeFilename.toLowerCase().endsWith('.pdf')) {
           const { extractPixCodeFromPdf } = await import('./qrExtractor');
           pixCode = await extractPixCodeFromPdf(buffer);
        }
      }

      // Create document record
      let competence = competencia || "";
      if (!competence && vencimento) {
        // Assume format DD/MM/YYYY and extract MM/YYYY
        const parts = vencimento.split("/");
        if (parts.length >= 2) {
          competence = `${parts[1]}/${parts.length === 3 ? parts[2] : new Date().getFullYear()}`;
        }
      }

      let titleStr = categoria === 'SITFIS_RECEITA' ? `SitFis Extração` : (nome_arquivo || `Documento ${categoria}`);
      if (dados_extraidos && Array.isArray(dados_extraidos) && dados_extraidos.length > 0) {
         titleStr += ` - ${dados_extraidos[0].orgao}: ${dados_extraidos[0].status}`;
         
         const hasPending = dados_extraidos.some(d => String(d.status).toUpperCase() === "PENDENTE");
         if (hasPending) {
           await db.update(clients).set({ regularityStatus: "red" }).where(eq(clients.id, client.id));
         }
      }
      
      const newDoc = await db.insert(documents).values({
        clientId: client.id,
        title: titleStr,
        category: categoria || "webhook_doc",
        competence: competence || "00/0000",
        dueDate: vencimento || null,
        fileUrl: safeFilename ? `/uploads/${safeFilename}` : null,
        pixCode: pixCode,
        extractedData: dados_extraidos || null,
        status: "new",
        uploadedBy: "accountant" // As it comes from integration system
      }).returning();

      res.status(200).json({ success: true, documentId: newDoc[0].id });
    } catch (e: any) {
      console.error("Webhook Error:", e);
      res.status(500).json({ error: e.message });
    }
  });

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

  app.post("/api/client/update-billing", verifyClientAuth, async (req, res) => {
    const clientId = (req as any).user.clientId;
    const { month, servicesRevenue, salesRevenue, totalIncomes, servicesTaken } = req.body;
    
    try {
      const existing = await db.select().from(billingData).where(eq(billingData.clientId, clientId));
      const target = existing.find(b => b.month === month);
      
      const updatePayload = {
        servicesRevenue: servicesRevenue || 0,
        salesRevenue: salesRevenue || 0,
        totalIncomes: totalIncomes || 0,
        servicesTaken: servicesTaken || 0,
        // Legacy fallback
        revenue: (servicesRevenue || 0) + (salesRevenue || 0),
        expenses: servicesTaken || 0,
        payroll: 0
      };

      if (target) {
        await db.update(billingData).set(updatePayload).where(eq(billingData.id, target.id));
      } else {
        await db.insert(billingData).values({
          ...updatePayload,
          clientId,
          month
        });
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/client/bulk-billing", verifyClientAuth, async (req, res) => {
    const clientId = (req as any).user.clientId;
    const { data } = req.body; // Array of items
    
    try {
      for (const item of data) {
        const { month, servicesRevenue, salesRevenue, totalIncomes, servicesTaken } = item;
        const existing = await db.select().from(billingData).where(eq(billingData.clientId, clientId));
        const target = existing.find(b => b.month === month);
        
        const updatePayload = {
          servicesRevenue: servicesRevenue || 0,
          salesRevenue: salesRevenue || 0,
          totalIncomes: totalIncomes || 0,
          servicesTaken: servicesTaken || 0,
          // Legacy fallback
          revenue: (servicesRevenue || 0) + (salesRevenue || 0),
          expenses: servicesTaken || 0,
          payroll: 0
        };

        if (target) {
          await db.update(billingData).set(updatePayload).where(eq(billingData.id, target.id));
        } else {
          await db.insert(billingData).values({
            ...updatePayload,
            clientId,
            month
          });
        }
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Upload file by client
  // Gerar Guia (DCTFWEB / PGDASD) SERPRO
  app.post("/api/pendencies/guia/:clienteId", verifyClientAuth, async (req, res) => {
    try {
      const clientId = req.params.clienteId;
      const { tipoGuia, competencia, documentId } = req.body;
      
      if (!tipoGuia || !competencia) {
        return res.status(400).json({ error: "tipoGuia e competencia são obrigatórios." });
      }

      if (!["DCTFWEB_INSS", "DAS_SIMPLES"].includes(tipoGuia)) {
        return res.status(400).json({ error: "tipoGuia inválido." });
      }

      if (!/^\d{6}$/.test(competencia)) {
        return res.status(400).json({ error: "competencia deve ter formato AAAAMM." });
      }

      const clientList = await db.select().from(clients).where(eq(clients.id, clientId));
      if (clientList.length === 0) {
         return res.status(404).json({ error: "Cliente não encontrado." });
      }

      // Simulate generating guide logic
      await new Promise(r => setTimeout(r, 1500));

      const fakePdfUrl = `https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf`;
      const today = new Date();
      // Add a few days for new due date
      today.setDate(today.getDate() + 3);
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const vencFormatado = `${year}-${month}-${day}`;

      const insertedGuia = await db.insert(guiasGeradas).values({
        clientId: clientId,
        usuarioId: 1, // dummy user id
        tipoGuia: tipoGuia,
        competencia: competencia,
        status: 'CONCLUIDO',
        dataVencimento: vencFormatado,
        valorTotal: tipoGuia === "DCTFWEB_INSS" ? 450.00 : 120.50,
        pdfPath: fakePdfUrl,
        concluidoAt: new Date()
      }).returning();

      if (documentId) {
        // Also update the original document's due date and fileUrl to reflect the new guide
        await db.update(documents)
          .set({ dueDate: vencFormatado, fileUrl: fakePdfUrl })
          .where(eq(documents.id, documentId));
      }

      res.json({
        status: "CONCLUIDO",
        guiaId: insertedGuia[0].id,
        dataVencimento: vencFormatado,
        valorTotal: insertedGuia[0].valorTotal,
        pdfPath: fakePdfUrl
      });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/pendencies/guia/:clienteId/historico", verifyClientAuth, async (req, res) => {
    try {
      const clientId = req.params.clienteId;
      const historico = await db.select().from(guiasGeradas).where(eq(guiasGeradas.clientId, clientId)).orderBy(desc(guiasGeradas.id)).limit(20);
      res.json({ success: true, historico });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/client/upload", verifyClientAuth, upload.single("file"), async (req, res) => {
    const clientId = (req as any).user.clientId;
    const { title, category, competence } = req.body;
    
    const [newDoc] = await db.insert(documents).values({
      clientId,
      title: title || `Documento ${category}`,
      category,
      competence,
      fileUrl: req.file ? `/uploads/${req.file.filename}` : null,
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

  app.post("/api/accountant/clients", verifyAccountantAuth, async (req, res) => {
    const { cnpj, name, regularityStatus, integrationHash, accountantCategory } = req.body;
    try {
      const [newClient] = await db.insert(clients).values({
        cnpj,
        name,
        passwordHash: cnpj,
        regularityStatus: regularityStatus || "green",
        integrationHash: integrationHash || null,
        accountantCategory: accountantCategory || null
      }).returning();
      res.json({ success: true, client: newClient });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/accountant/client/:id", verifyAccountantAuth, async (req, res) => {
    const { name, regularityStatus, integrationHash, accountantCategory } = req.body;
    try {
      const [updated] = await db.update(clients).set({
        name,
        regularityStatus,
        integrationHash: integrationHash || null,
        accountantCategory: accountantCategory || null
      }).where(eq(clients.id, req.params.id)).returning();
      res.json({ success: true, client: updated });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/accountant/client/:id", verifyAccountantAuth, async (req, res) => {
    try {
      const clientId = req.params.id;
      // Delete dependencies
      await db.delete(documents).where(eq(documents.clientId, clientId));
      await db.delete(billingData).where(eq(billingData.clientId, clientId));
      await db.delete(messages).where(eq(messages.clientId, clientId));
      
      // Delete client
      await db.delete(clients).where(eq(clients.id, clientId));
      res.json({ success: true });
    } catch (e: any) {
      console.error(e);
      res.status(400).json({ error: e.message });
    }
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

  app.get("/api/accountant/files/stats", verifyAccountantAuth, async (req, res) => {
    try {
      const allDocs = await db.select().from(documents);
      let totalSize = 0;
      for (const doc of allDocs) {
         if (doc.fileUrl) {
            if (doc.fileUrl.startsWith("data:")) {
               const base64str = doc.fileUrl.split(",")[1];
               if (base64str) {
                  totalSize += Math.floor((base64str.length * 3) / 4);
               }
            } else if (doc.fileUrl.startsWith("/uploads/")) {
               const filePath = path.join(process.cwd(), doc.fileUrl);
               try {
                  if (fs.existsSync(filePath)) {
                     const stat = fs.statSync(filePath);
                     totalSize += stat.size;
                  }
               } catch (e) {}
            }
         }
      }
      res.json({ totalSize });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/accountant/files", verifyAccountantAuth, async (req, res) => {
    try {
      const allDocs = await db.select().from(documents).orderBy(desc(documents.createdAt));
      const allClients = await db.select().from(clients);
      
      const filesWithMetadata = allDocs.map(doc => {
         const cl = allClients.find(c => c.id === doc.clientId);
         let size = 0;
         
         if (doc.fileUrl) {
            if (doc.fileUrl.startsWith("data:")) {
               const base64str = doc.fileUrl.split(",")[1];
               if (base64str) {
                  size = Math.floor((base64str.length * 3) / 4);
               }
            } else if (doc.fileUrl.startsWith("/uploads/")) {
               const filePath = path.join(process.cwd(), doc.fileUrl);
               try {
                  if (fs.existsSync(filePath)) {
                     const stat = fs.statSync(filePath);
                     size = stat.size;
                  }
               } catch (e) {}
            }
         }
         
         return {
            id: doc.id,
            title: doc.title,
            category: doc.category,
            status: doc.status,
            createdAt: doc.createdAt.toISOString(),
            fileUrl: doc.fileUrl,
            size,
            clientName: cl?.name || "Desconhecido",
            clientId: doc.clientId,
            uploadedBy: doc.uploadedBy
         };
      });
      
      res.json({ files: filesWithMetadata });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/accountant/files/bulk", verifyAccountantAuth, async (req, res) => {
    try {
      const { fileIds } = req.body;
      if (!Array.isArray(fileIds) || fileIds.length === 0) {
        return res.status(400).json({ error: "Nenhum arquivo selecionado" });
      }

      const docsToDelete = await db.select().from(documents).where(inArray(documents.id, fileIds));
      
      for (const doc of docsToDelete) {
         if (doc.fileUrl && doc.fileUrl.startsWith("/uploads/")) {
            const filePath = path.join(process.cwd(), doc.fileUrl);
            try {
               if (fs.existsSync(filePath)) {
                  fs.unlinkSync(filePath);
               }
            } catch (e) {}
         }
      }

      await db.delete(documents).where(inArray(documents.id, fileIds));
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
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

  app.post("/api/accountant/upload-doc", verifyAccountantAuth, upload.single("file"), async (req, res) => {
    const { clientId, title, category, dueDate, competence } = req.body;
    
    const [newDoc] = await db.insert(documents).values({
      clientId,
      title,
      category,
      dueDate,
      competence,
      fileUrl: req.file ? `/uploads/${req.file.filename}` : null,
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

  app.post("/api/accountant/message/bulk", verifyAccountantAuth, async (req, res) => {
    const { clientIds, content } = req.body;
    
    if (!Array.isArray(clientIds) || clientIds.length === 0) {
      return res.status(400).json({ error: "Nenhum cliente selecionado" });
    }

    const newMessages = clientIds.map((id: string) => ({
      clientId: id,
      content,
      read: false
    }));

    await db.insert(messages).values(newMessages);
    res.json({ success: true });
  });
  
  app.post("/api/accountant/document/:id/status", verifyAccountantAuth, async (req, res) => {
    try {
      const { status } = req.body;
      await db.update(documents).set({ status }).where(eq(documents.id, req.params.id));
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/accountant/message/:id", verifyAccountantAuth, async (req, res) => {
    try {
      await db.delete(messages).where(eq(messages.id, req.params.id));
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/accountant/message/:id", verifyAccountantAuth, async (req, res) => {
    try {
      const { content } = req.body;
      await db.update(messages).set({ content }).where(eq(messages.id, req.params.id));
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
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

  // Webhook for External System Integration
  app.post("/api/webhook/documentos", upload.single("arquivo"), async (req, res) => {
    try {
      let companyHash, categoria, nomeArquivo, dataVencimento;
      let arquivoBase64 = null;

      if (req.file) {
        // multipart/form-data
        companyHash = req.body.companyHash;
        categoria = req.body.categoria || "Outros";
        nomeArquivo = req.body.nomeArquivo || req.file.originalname;
        dataVencimento = req.body.dataVencimento;
        arquivoBase64 = "data:" + req.file.mimetype + ";base64," + req.file.buffer.toString("base64");
      } else {
        // JSON
        companyHash = req.body.companyHash;
        categoria = req.body.categoria || "Outros";
        nomeArquivo = req.body.nomeArquivo || "Documento Integrado";
        dataVencimento = req.body.dataVencimento;
        if (req.body.arquivo) {
           arquivoBase64 = String(req.body.arquivo).startsWith("data:") 
              ? req.body.arquivo 
              : "data:application/pdf;base64," + req.body.arquivo;
        }
      }

      if (!companyHash) {
        return res.status(400).json({ error: "O parâmetro companyHash é obrigatório" });
      }

      const clientList = await db.select().from(clients).where(eq(clients.integrationHash, companyHash));
      if (clientList.length === 0) {
        return res.status(404).json({ error: "Empresa não encontrada para este hash" });
      }

      const targetClient = clientList[0];

      // Create document
      const [newDoc] = await db.insert(documents).values({
        clientId: targetClient.id,
        title: nomeArquivo,
        category: categoria,
        dueDate: dataVencimento || null,
        status: "new",
        uploadedBy: "accountant",
        fileUrl: arquivoBase64
      }).returning();

      return res.status(201).json({ 
        success: true, 
        message: "Documento salvo com sucesso",
        documentId: newDoc.id 
      });
      
    } catch (e: any) {
      console.error("Webhook Erro:", e);
      return res.status(500).json({ error: "Erro interno no servidor webhook: " + e.message });
    }
  });

  // Accountant update billing for client
  app.post("/api/accountant/client/:id/update-billing", verifyAccountantAuth, async (req, res) => {
    const clientId = req.params.id;
    const { month, servicesRevenue, salesRevenue, totalIncomes, servicesTaken } = req.body;
    
    try {
      const existing = await db.select().from(billingData).where(eq(billingData.clientId, clientId));
      const target = existing.find(b => b.month === month);
      
      const updatePayload = {
        servicesRevenue: servicesRevenue || 0,
        salesRevenue: salesRevenue || 0,
        totalIncomes: totalIncomes || 0,
        servicesTaken: servicesTaken || 0,
        // Legacy fallback
        revenue: (servicesRevenue || 0) + (salesRevenue || 0),
        expenses: servicesTaken || 0,
        payroll: 0
      };

      if (target) {
        await db.update(billingData).set(updatePayload).where(eq(billingData.id, target.id));
      } else {
        await db.insert(billingData).values({
          ...updatePayload,
          clientId,
          month
        });
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Accountant bulk billing upload for client
  app.post("/api/accountant/client/:id/bulk-billing", verifyAccountantAuth, async (req, res) => {
    const clientId = req.params.id;
    const { data } = req.body; // Array of items
    
    try {
      for (const item of data) {
        const { month, servicesRevenue, salesRevenue, totalIncomes, servicesTaken } = item;
        const existing = await db.select().from(billingData).where(eq(billingData.clientId, clientId));
        const target = existing.find(b => b.month === month);
        
        const updatePayload = {
          servicesRevenue: servicesRevenue || 0,
          salesRevenue: salesRevenue || 0,
          totalIncomes: totalIncomes || 0,
          servicesTaken: servicesTaken || 0,
          // Legacy fallback
          revenue: (servicesRevenue || 0) + (salesRevenue || 0),
          expenses: servicesTaken || 0,
          payroll: 0
        };

        if (target) {
          await db.update(billingData).set(updatePayload).where(eq(billingData.id, target.id));
        } else {
          await db.insert(billingData).values({
            ...updatePayload,
            clientId,
            month
          });
        }
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/vapidPublicKey", (req, res) => {
    res.send(vapidKeys.publicKey);
  });

  // SERPRO config
  app.get("/api/pendencies/sitfis/config", verifyAccountantAuth, async (req, res) => {
    try {
      let config = await db.select().from(serproConfig).where(eq(serproConfig.usuarioId, 1)).limit(1);
      if (config.length === 0) {
        return res.json({ success: true, config: null });
      }
      res.json({ success: true, config: config[0] });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/pendencies/sitfis/config", verifyAccountantAuth, uploadCert.single("cert"), async (req, res) => {
    try {
      const { consumerKey, consumerSecret, certSenha, cnpjContratante, ambiente } = req.body;
      
      const updateData: any = {
        consumerKey,
        consumerSecret,
        cnpjContratante,
        ambiente
      };
      
      if (certSenha) updateData.certSenha = certSenha;
      if (req.file) updateData.certPath = req.file.path;

      let config = await db.select().from(serproConfig).where(eq(serproConfig.usuarioId, 1)).limit(1);
      
      if (config.length === 0) {
        await db.insert(serproConfig).values({
          usuarioId: 1,
          ...updateData
        });
      } else {
        await db.update(serproConfig).set(updateData).where(eq(serproConfig.id, config[0].id));
      }

      res.json({ success: true });
    } catch (e: any) {
      console.error("ERRO SERPRO POST:", e);
      res.status(500).json({ error: e.message, stack: e.stack, detail: e.toString() });
    }
  });

  app.post("/api/notifications/subscribe", verifyClientAuth, async (req, res) => {
    try {
      const clientId = (req as any).user.clientId;
      const { subscriptionObject, deviceName } = req.body;
      
      await db.insert(subscriptions).values({
        clientId,
        subscriptionObject,
        deviceName: deviceName || "Dispositivo"
      });
      res.status(201).json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/admin/notifications/send", verifyAccountantAuth, async (req, res) => {
    try {
      const { userIds, title, body } = req.body;
      
      let subs = [];
      if (userIds && userIds.length > 0) {
        subs = await db.select().from(subscriptions).where(inArray(subscriptions.clientId, userIds));
      } else {
        subs = await db.select().from(subscriptions);
      }
      
      const payload = JSON.stringify({ title, body });
      
      const promises = subs.map(sub => {
        return webpush.sendNotification(sub.subscriptionObject as webpush.PushSubscription, payload).catch(err => {
          console.error("Error sending push to sub:", sub.id, err);
          if (err.statusCode === 410 || err.statusCode === 404) {
             return db.delete(subscriptions).where(eq(subscriptions.id, sub.id));
          }
        });
      });
      
      await Promise.all(promises);
      res.status(200).json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

}
