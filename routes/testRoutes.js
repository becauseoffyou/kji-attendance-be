const express = require("express");
const router = express.Router();

const controller = require("../controllers/testController");

router.post("/email", controller.testEmail);

module.exports = router;
