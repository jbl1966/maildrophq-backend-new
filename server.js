import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

const accounts = new Map(); // Key: prefix, Value: { id, token, address }

app.get("/api/generate", async (req, res) => {
  try {
    const prefix = req.query.prefix || Math.random().toString(36).substring(2, 10);
    const domain = "punkproof.com";
    const address = `${prefix}@${domain}`;
    const password = "password123";

    // 1. Register new account
    const regRes = await fetch("https://api.mail.tm/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, password }),
    });

    const regText = await regRes.text();
    let regData = {};
    try {
      regData = JSON.parse(regText);
    } catch (e) {
      console.error("❌ Invalid JSON from register:", regText);
      throw new Error("Registration JSON parse failed");
    }

    if (!regData.address) {
      console.error("❌ Registration failed:", regData);
      throw new Error("Registration failed");
    }

    // 2. Log in to get token
    const loginRes = await fetch("https://api.mail.tm/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, password }),
    });

    const loginText = await loginRes.text();
    let loginData = {};
    try {
      loginData = JSON.parse(loginText);
    } catch (e) {
      console.error("❌ Invalid JSON from login:", loginText);
      throw new Error("Login JSON parse failed");
    }

    if (!loginData.token) {
      console.error("❌ Login failed:", loginData);
      throw new Error("Login failed");
    }

    // 3. Save to in-memory map
    accounts.set(prefix, {
      id: regData.id,
      token: loginData.token,
      address: regData.address,
    });

    console.log("✅ Email generated:", regData.address);
    return res.json({ prefix, domain });

  } catch (err) {
    console.error("🚨 Email generation error:", err.message);
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
  res.send("✅ MailDropHQ Backend is live.");
});

app.listen(port, () => {
  console.log(`✅ MailDropHQ Backend is running on port ${port}`);
});
