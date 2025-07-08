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
  const requestedPrefix = req.query.prefix;
  const password = "password123";

  try {
    // ✅ Get a valid mail.tm domain
    const domainRes = await fetch("https://api.mail.tm/domains");
    const domainData = await domainRes.json();
    const domain = domainData["hydra:member"]?.[0]?.domain;

    if (!domain) {
      throw new Error("No valid mail.tm domain found.");
    }

    const prefix = requestedPrefix || Math.random().toString(36).substring(2, 10);
    const address = `${prefix}@${domain}`;

    // ✅ Register
    const register = await fetch("https://api.mail.tm/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, password }),
    });

    const regText = await register.text();
    let regData;

    try {
      regData = JSON.parse(regText);
    } catch (jsonErr) {
      console.error("❌ Failed to parse registration response:", regText);
      throw new Error("Invalid register response.");
    }

    if (!regData.address) {
      console.error("❌ Mail.tm registration failed:", regData);
      throw new Error("Mail.tm registration failed.");
    }

    // ✅ Login
    const login = await fetch("https://api.mail.tm/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, password }),
    });

    const tokenData = await login.json();
    if (!tokenData.token) {
      console.error("❌ Mail.tm login failed:", tokenData);
      throw new Error("Mail.tm login failed.");
    }

    accounts.set(prefix, {
      id: regData.id,
      token: tokenData.token,
      address: regData.address,
    });

    return res.json({ prefix, domain });
  } catch (err) {
    console.error("❌ Email generation error:", err);
    return res.status(500).json({ error: "Email generation failed." });
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
