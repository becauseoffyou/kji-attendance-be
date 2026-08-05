const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const controller = require("../controllers/notificationController");

router.get("/badge", auth, controller.badge);

module.exports = router;
