import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

const accounts = new Map(); // Stores: { id, token, address }

function generateRandomPrefix() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// Utility: create and log in to a mail.tm account
async function createMailTmAccount(prefix = "") {
  const domain = "punkproof.com";
  const address = `${prefix}@${domain}`;
  const password = "password123";

  // Register
  const registerRes = await fetch("https://api.mail.tm/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, password }),
  });

  const regData = await registerRes.json();
  if (!regData.address) {
    throw new Error("Registration failed");
  }

  // Login
  const loginRes = await fetch("https://api.mail.tm/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, password }),
  });

  const tokenData = await loginRes.json();
  if (!tokenData.token) {
    throw new Error("Login failed");
  }

  const [actualPrefix] = regData.address.split("@");
  accounts.set(actualPrefix, {
    id: regData.id,
    token: tokenData.token,
    address: regData.address,
  });

  return { prefix: actualPrefix, domain };
}

// ✅ Generate email (random or custom)
app.get("/api/generate", async (req, res) => {
  try {
    const requestedPrefix = req.query.prefix;
    const isCustom = !!requestedPrefix;
    const prefix = isCustom ? requestedPrefix.toLowerCase() : generateRandomPrefix();

    // Validate prefix for custom emails
    if (isCustom && !/^[a-zA-Z0-9._-]{3,30}$/.test(prefix)) {
      return res.status(400).json({ error: "Invalid custom prefix format." });
    }

    // Avoid duplicate regeneration
    if (accounts.has(prefix)) {
      const domain = "punkproof.com";
      return res.json({ prefix, domain });
    }

    const result = await createMailTmAccount(prefix);
    res.json(result);
  } catch (err) {
    console.error("Email generation error:", err.message);
    res.status(500).json({ error: "Email generation failed." });
  }
});

// ✅ Get inbox messages
app.get("/api/messages", async (req, res) => {
  const { prefix } = req.query;

  if (!prefix || !accounts.has(prefix)) {
    return res.status(404).json({ error: "Unknown or missing email prefix." });
  }

  const { token } = accounts.get(prefix);

  try {
    const inboxRes = await fetch("https://api.mail.tm/messages", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const inboxData = await inboxRes.json();
    res.json(inboxData["hydra:member"] || []);
  } catch (err) {
    console.error("Inbox fetch error:", err.message);
    res.status(500).json({ error: "Failed to load inbox." });
  }
});

// ✅ Get specific message
app.get("/api/message", async (req, res) => {
  const { prefix, id } = req.query;

  if (!prefix || !id || !accounts.has(prefix)) {
    return res.status(404).json({ error: "Invalid request or unknown prefix." });
  }

  const { token } = accounts.get(prefix);

  try {
    const msgRes = await fetch(`https://api.mail.tm/messages/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const msgData = await msgRes.json();
    res.json(msgData);
  } catch (err) {
    console.error("Message fetch error:", err.message);
    res.status(500).json({ error: "Failed to load message." });
  }
});

// ✅ Root route
app.get("/", (req, res) => {
  res.send("✅ MailDropHQ Backend is running.");
});

app.listen(port, () => {
  console.log(`✅ MailDropHQ Backend is running on port ${port}`);
});
