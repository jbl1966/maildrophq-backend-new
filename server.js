app.get("/api/generate", async (req, res) => {
  try {
    const prefix = req.query.prefix || Math.random().toString(36).substring(2, 10);
    const address = `${prefix}@punkproof.com`;
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

    const [actualPrefix, domain] = regData.address.split("@");

    accounts.set(actualPrefix, {
      id: regData.id,
      token: tokenData.token,
      address: regData.address,
    });

    return res.json({ prefix: actualPrefix, domain });
  } catch (err) {
    console.error("Email generation error:", err);
    return res.status(500).json({ error: "Email generation failed." });
  }
});
