const express = require("express");

const router = express.Router();

const auth = require("../middleware/authMiddleware");

const upload = require("../middleware/uploadAttendance");

const leaveController = require("../controllers/leaveController");

router.post("/", auth, upload.single("attachment"), leaveController.create);

module.exports = router;
