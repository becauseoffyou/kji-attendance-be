const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");

const controller = require("../controllers/leaderController");

router.get("/leave", auth, controller.leaveRequests);
router.get("/leave/:id", auth, controller.leaveDetail);
router.patch("/leave/:id/reject", authMiddleware, leaderController.rejectLeave);

module.exports = router;
