const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");

const controller = require("../controllers/leaderController");

router.get("/leave", auth, controller.leaveRequests);

module.exports = router;
