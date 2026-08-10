const express = require("express");
const router = express.Router();
const uploadAttendance = require("../middleware/uploadAttendance");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");
const attendanceController = require("../controllers/attendanceController");

router.get("/today", authMiddleware, attendanceController.today);
router.get("/history", authMiddleware, attendanceController.history);
router.get("/chart", authMiddleware, attendanceController.chart);
router.get("/info", authMiddleware, attendanceController.list);
router.get(
  "/summary",
  authMiddleware,
  adminMiddleware,
  attendanceController.getDashboardSummary,
);

router.get(
  "/daily",
  authMiddleware,
  adminMiddleware,
  attendanceController.getDailyAttendance,
);

router.get(
  "/departments",
  authMiddleware,
  adminMiddleware,
  attendanceController.getDepartments,
);

router.get(
  "/employee/:id",
  authMiddleware,
  adminMiddleware,
  attendanceController.getEmployeeAttendance,
);

router.post(
  "/checkin",
  authMiddleware,
  uploadAttendance.single("photo"),
  attendanceController.checkIn,
);
router.post(
  "/checkout",
  authMiddleware,
  uploadAttendance.single("photo"),
  attendanceController.checkOut,
);

router.get(
  "/employee-of-month",
  authMiddleware,
  adminMiddleware,
  attendanceController.getEmployeeOfMonth,
);

router.get(
  "/attendance-summary",
  authMiddleware,
  adminMiddleware,
  attendanceController.getAttendanceSummary,
);
module.exports = router;
