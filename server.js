// server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

const accounts = new Map(); // Key: prefix, Value: { id, token, address }

function isValidPrefix(prefix) {
  return /^[a-zA-Z0-9._-]{3,30}$/.test(prefix);
}

function generateRandomPrefix() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

app.get("/api/generate", async (req, res) => {
  try {
    let { prefix } = req.query;

    if (prefix) {
      if (!isValidPrefix(prefix)) {
        return res.status(400).json({ error: "Invalid custom prefix. Use only letters, numbers, dots, dashes, and underscores (3–30 characters)." });
      }
    } else {
      prefix = generateRandomPrefix();
    }

    const domain = "punkproof.com";
    const address = `${prefix}@${domain}`;
    const password = "password123";

    const register = await fetch("https://api.mail.tm/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, password }),
    });

    const regData = await register.json();
    if (!regData.address) {
      throw new Error("Registration failed");
    }

    const login = await fetch("https://api.mail.tm/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, password }),
    });

    const tokenData = await login.json();
    if (!tokenData.token) {
      throw new Error("Login failed");
    }

    accounts.set(prefix, {
      id: regData.id,
      token: tokenData.token,
      address: regData.address,
    });

    return res.json({ prefix, domain });
  } catch (err) {
    console.error("Email generation error:", err);
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
    console.error("Inbox fetch error:", err);
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
    console.error("Message fetch error:", err);
    return res.status(500).json({ error: "Failed to load message." });
  }
});

app.get("/", (req, res) => {
  res.send("✅ MailDropHQ Backend is running.");
});

app.listen(port, () => {
  console.log(`✅ MailDropHQ Backend is running on port ${port}`);
});
