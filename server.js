import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

const accounts = new Map();

function generateEmailAddress(prefix) {
  const random = prefix || Math.random().toString(36).substring(2, 10);
  return `${random}@punkproof.com`;
}

app.get("/api/generate", async (req, res) => {
  try {
    const prefix = req.query.prefix;
    const address = generateEmailAddress(prefix);
    const password = "password123";

    const register = await fetch("https://api.mail.tm/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, password }),
    });

    const regData = await register.json();
    if (!regData.address) throw new Error("Registration failed");

    const login = await fetch("https://api.mail.tm/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, password }),
    });

    const tokenData = await login.json();
    if (!tokenData.token) throw new Error("Login failed");

    const [actualPrefix, domain] = regData.address.split("@");
    accounts.set(actualPrefix, {
      id: regData.id,
      token: tokenData.token,
      address: regData.address,
    });

    res.json({ prefix: actualPrefix, domain });
  } catch (err) {
    console.error("Email generation error:", err);
    res.status(500).json({ error: "Email generation failed." });
  }
});

app.get("/api/messages", async (req, res) => {
  const { prefix } = req.query;
  if (!accounts.has(prefix)) return res.status(404).json({ error: "Unknown email prefix." });

  const { token } = accounts.get(prefix);
  const response = await fetch("https://api.mail.tm/messages", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  res.json(data["hydra:member"] || []);
});

app.get("/api/message", async (req, res) => {
  const { prefix, id } = req.query;
  if (!accounts.has(prefix)) return res.status(404).json({ error: "Unknown email prefix." });

  const { token } = accounts.get(prefix);
  const response = await fetch(`https://api.mail.tm/messages/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  res.json(data);
});

app.listen(port, () => console.log(`✅ MailDropHQ Backend running on ${port}`));
