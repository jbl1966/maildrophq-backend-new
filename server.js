import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

const accounts = new Map(); // Key: prefix, Value: { id, token, address }

function generateRandomPrefix() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function isValidPrefix(prefix) {
  return /^[a-zA-Z0-9._-]{3,30}$/.test(prefix);
}

async function createMailTmAccount(prefix) {
  const address = `${prefix}@punkproof.com`;
  const password = "password123";

  try {
    // Register
    const register = await fetch("https://api.mail.tm/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, password }),
    });

    const regText = await register.text();
    let regData;
    try {
      regData = JSON.parse(regText);
    } catch (err) {
      throw new Error("Invalid JSON during registration: " + regText);
    }

    if (!regData.address) {
      throw new Error("Registration failed: " + (regData.detail || JSON.stringify(regData)));
    }

    // Login
    const login = await fetch("https://api.mail.tm/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, password }),
    });

    const loginText = await login.text();
    let tokenData;
    try {
      tokenData = JSON.parse(loginText);
    } catch (err) {
      throw new Error("Invalid JSON during login: " + loginText);
    }

    if (!tokenData.token) {
      throw new Error("Login failed: " + JSON.stringify(tokenData));
    }

    // Save
    accounts.set(prefix, {
      id: regData.id,
      token: tokenData.token,
      address: regData.address,
    });

    return { prefix, domain: "punkproof.com" };
  } catch (err) {
    throw err;
  }
}

app.get("/api/generate", async (req, res) => {
  const requestedPrefix = req.query.prefix;
  let finalPrefix = null;

  try {
    if (requestedPrefix && isValidPrefix(requestedPrefix)) {
      try {
        finalPrefix = requestedPrefix.toLowerCase();
        const result = await createMailTmAccount(finalPrefix);
        return res.json(result);
      } catch (err) {
        console.warn(`⚠️ Custom prefix failed: ${requestedPrefix}. Falling back to random.`, err.message);
        // fall through to random below
      }
    }

    // Generate with random prefix
    let attempt = 0;
    while (attempt < 3) {
      finalPrefix = generateRandomPrefix();
      try {
        const result = await createMailTmAccount(finalPrefix);
        return res.json(result);
      } catch (err) {
        console.warn(`⚠️ Attempt ${attempt + 1} failed with ${finalPrefix}:`, err.message);
        attempt++;
      }
    }

    throw new Error("All attempts to generate email failed.");

  } catch (err) {
    console.error("❌ Email generation error:", err.message);
    return res.status(500).json({ error: "Email generation failed." });
  }
});

app.get("/api/messages", async (req, res) => {
  const { prefix } = req.query;

  if (!accounts.has(prefix)) {
    return res.status(404).json({ error: "Unknown email prefix." });
  }

  const { token } = accounts.get(prefix);

  try {
    const response = await fetch("https://api.mail.tm/messages", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await response.json();
    return res.json(data["hydra:member"] || []);
  } catch (err) {
    console.error("📨 Inbox fetch error:", err.message);
    return res.status(500).json({ error: "Failed to load inbox." });
  }
});

app.get("/api/message", async (req, res) => {
  const { prefix, id } = req.query;

  if (!accounts.has(prefix)) {
    return res.status(404).json({ error: "Unknown email prefix." });
  }

  const { token } = accounts.get(prefix);

  try {
    const response = await fetch(`https://api.mail.tm/messages/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await response.json();
    return res.json(data);
  } catch (err) {
    console.error("📩 Message fetch error:", err.message);
    return res.status(500).json({ error: "Failed to load message." });
  }
});

app.get("/", (req, res) => {
  res.send("✅ MailDropHQ Backend is live.");
});

app.listen(port, () => {
  console.log(`✅ MailDropHQ Backend is running on port ${port}`);
});
