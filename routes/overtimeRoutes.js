const express = require("express");

const router = express.Router();

const auth = require("../middleware/authMiddleware");

const controller = require("../controllers/overtimeController");

router.post(
    "/",
    auth,
    controller.create,
);

router.get(
    "/history",
    auth,
    controller.history
);

module.exports = router;