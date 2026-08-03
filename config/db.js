require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.on("connect", async (client) => {
  await client.query("SET TIME ZONE 'Asia/Jakarta'");

  console.log("✅ PostgreSQL Client Connected");
  console.log("🌏 Timezone: Asia/Jakarta");
});

pool.on("error", (err) => {
  console.error("❌ PostgreSQL Pool Error:", err);
});

module.exports = pool;
