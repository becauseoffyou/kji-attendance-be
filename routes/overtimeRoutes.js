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

router.put(
    "/:id/approve",
    auth,
    controller.approveByManager
);

router.put(
    "/:id/reject",
    auth,
    controller.rejectByManager
);

router.get(
    "/manager",
    auth,
    controller.managerHistory
);

router.get(
    "/manager/:id",
    auth,
    controller.managerDetail
);

router.patch(
    "/:id/pay",
    auth,
    controller.markAsPaid
);

router.get(
    "/admin/recap",
    auth,
    controller.getAdminRecap
);

router.get(
    "admin/settings",
    auth,
    controller.getOvertimeSettings
);

router.patch(
    "admin/settings",
    auth,
    controller.updateOvertimeSettings
);
module.exports = router;