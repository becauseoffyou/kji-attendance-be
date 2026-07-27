require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});

pool.on("connect", () => {
    console.log("✅ PostgreSQL Client Connected");
});

pool.on("error", (err) => {
    console.error("❌ PostgreSQL Pool Error:", err);
});

module.exports = pool;