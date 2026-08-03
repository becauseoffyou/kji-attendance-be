const express = require("express");

const router = express.Router();

const auth = require("../middleware/auth");

const upload = require("../middleware/upload");

const leaveController = require("../controllers/leaveController");

router.post("/", auth, upload.single("attachment"), leaveController.create);

module.exports = router;
