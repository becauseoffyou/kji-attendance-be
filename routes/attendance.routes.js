const express = require("express");
const router = express.Router();
const uploadAttendance = require("../middleware/uploadAttendance");
const authMiddleware = require("../middleware/authMiddleware");
const attendanceController = require("../controllers/attendanceController");

router.get("/today", authMiddleware, attendanceController.today);
router.get("/history", authMiddleware, attendanceController.history);
router.get("/chart", authMiddleware, attendanceController.chart);
router.get("/info", authMiddleware, attendanceController.list);

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

module.exports = router;
