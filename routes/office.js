const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/authMiddleware");
const officeController = require("../controllers/officeController");

router.get(
    "/current",
    authMiddleware,
    officeController.currentOffice
);

module.exports = router;