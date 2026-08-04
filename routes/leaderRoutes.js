const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");

const controller = require("../controllers/leaderController");

router.get("/leave", auth, controller.leaveRequests);
router.get("/leave/:id", auth, controller.leaveDetail);
router.patch("/leave/:id/reject", auth, controller.rejectLeave);
router.patch("/leave/:id/approve", auth, controller.approveLeave);

module.exports = router;
