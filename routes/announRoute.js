const express = require("express");

const router = express.Router();

const announcementController =
    require("../controllers/announcementController");

const authMiddleware =
    require("../middleware/authMiddleware");

const adminMiddleware =
    require("../middleware/adminMiddleware");


// =====================================
// EMPLOYEE
// =====================================

router.get(
    "/active",
    authMiddleware,
    announcementController.getActiveAnnouncements
);


// =====================================
// HR / ADMIN
// =====================================

router.get(
    "/",
    authMiddleware,
    adminMiddleware,
    announcementController.getAllAnnouncements
);


router.post(
    "/",
    authMiddleware,
    adminMiddleware,
    announcementController.createAnnouncement
);


module.exports = router;