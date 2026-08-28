require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

// ==============================
// Database
// ==============================
const pool = require("./config/db");

// ==============================
// CORS
// ==============================

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://kji-attendance-fe.vercel.app",
    ],
    credentials: true,
    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==============================
// Routes
// ==============================
const authRoutes = require("./routes/authRoutes");
const attendanceRoutes = require("./routes/attendance.routes");
const officeRoutes = require("./routes/office");
const dashboardRoutes = require("./routes/dashboardRoutes");
const leaveRoutes = require("./routes/leaveRoutes");
const supervisorRoutes = require("./routes/leaderRoutes");
const notificationRoutes = require("./routes/notificationRoute");
const testRoutes = require("./routes/testRoutes");
const overtimeRoutes = require("./routes/overtimeRoutes");
const announcementRoutes =
  require("./routes/announRoute");
app.use(
  "/api/overtime",
  overtimeRoutes,
);

// ==============================
// Middleware
// ==============================
app.use(
  "/api/announcements",
  announcementRoutes
);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ==============================
// API Routes
// ==============================
app.use("/api/auth", authRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/office", officeRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/leader", supervisorRoutes);
app.use("/api/notification", notificationRoutes);
// ==============================
// Root
// ==============================
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "KJI Attendance API Running 🚀",
  });
});

// ==============================
// PostgreSQL Test
// ==============================
(async () => {
  try {
    const result = await pool.query("SELECT NOW()");
  } catch (err) {
    console.error("❌ PostgreSQL Error");
    console.error(err);
  }
})();

// ==============================
// Server
// ==============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
