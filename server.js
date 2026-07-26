const express = require("express");
const cors = require("cors");
const pool = require("./config/db");

require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "KJI Attendance API Running 🚀",
    });
});

// Test koneksi PostgreSQL
(async () => {
    try {
        console.log("🔄 Testing PostgreSQL connection...");

        const result = await pool.query("SELECT NOW()");

        console.log("✅ PostgreSQL Connected!");
        console.log(result.rows[0]);
    } catch (err) {
        console.error("❌ PostgreSQL Error:");
        console.error(err);
    }
})();