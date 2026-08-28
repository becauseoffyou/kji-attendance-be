const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

const { uploadEmployee } = require("../middleware/uploadMiddleware");
router.post("/login", authController.login);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.get("/me", authMiddleware, authController.me);

router.post(
  "/employees",
  authMiddleware,
  adminMiddleware,
  uploadEmployee.fields([
    {
      name: "photo",
      maxCount: 1,
    },
    {
      name: "ktp",
      maxCount: 1,
    },
  ]),
  authController.createEmployee,
);

router.get(
  "/employees",
  authMiddleware,
  adminMiddleware,
  authController.getEmployees,
);

router.get(
  "/roles",
  adminMiddleware,
  authController.getRoles
);

router.put(
  "/employees/:id",
  authMiddleware,
  adminMiddleware,
  uploadEmployee.fields([
    {
      name: "photo",
      maxCount: 1,
    },
    {
      name: "ktp",
      maxCount: 1,
    },
  ]),
  authController.updateEmployee,
);

router.patch(
  "/employees/:id/deactivate",
  authMiddleware,
  adminMiddleware,
  authController.deactivateEmployee,
);

router.patch(
  "/employees/:id/activate",
  authMiddleware,
  adminMiddleware,
  authController.activateEmployee,
);

module.exports = router;
