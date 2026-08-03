const express = require("express");

const router = express.Router();

const auth = require("../middleware/authMiddleware");

const upload = require("../middleware/leaveFile");

const leaveController = require("../controllers/leaveController");

router.post("/", auth, upload.single("attachment"), leaveController.create);
router.get("/history", auth, leaveController.history);
module.exports = router;
