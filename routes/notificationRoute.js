const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const controller = require("../controllers/notificationController");

router.get("/badge", auth, controller.badge);
router.patch("/read-pending", auth, controller.readPendingLeave);
router.patch("/read-result", auth, controller.readLeaveResult);

module.exports = router;
