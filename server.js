require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

const pool = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const attendanceRoutes = require("./routes/attendance.routes");
const officeRoutes = require("./routes/office");
const dashboardRoutes = require("./routes/dashboardRoutes");

app.use("/api/dashboard", dashboardRoutes);

app.use(cors({
    origin: [
        "http://localhost:5173",
        "https://kji-attendance-fe.vercel.app"
    ],
    credentials: true
}));

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/office", officeRoutes);

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

        console.error(err);

    }
})();

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
});