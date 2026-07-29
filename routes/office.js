const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const officeController = require("../controllers/officeController");

router.get(
    "/current",
    authMiddleware,
    officeController.currentOffice
);

module.exports = router;