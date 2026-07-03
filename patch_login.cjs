const fs = require('fs');
let content = fs.readFileSync('src/server/routes.ts', 'utf8');

const target = `  app.post("/api/auth/client/login", async (req, res) => {
    const { cnpj, password } = req.body;`;

const replacement = `  app.post("/api/auth/client/login", async (req, res) => {
    try {
      const { cnpj, password } = req.body;`;

const targetEnd = `      },
    });
  });

  // Accountant Login`;

const replacementEnd = `      },
    });
    } catch(err) {
      console.error("Login erro:", err);
      return res.status(500).json({ error: "Erro interno: banco de dados inacessível ou não configurado." });
    }
  });

  // Accountant Login`;

content = content.replace(target, replacement).replace(targetEnd, replacementEnd);
fs.writeFileSync('src/server/routes.ts', content);
console.log("Patched client login");
