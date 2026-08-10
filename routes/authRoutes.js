const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

const { uploadPhoto, uploadKtp } = require("../middleware/uploadMiddleware");

router.post("/login", authController.login);

router.get("/me", authMiddleware, authController.me);

router.post(
  "/employees",
  authMiddleware,
  adminMiddleware,
  uploadPhoto.fields([
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

module.exports = router;
