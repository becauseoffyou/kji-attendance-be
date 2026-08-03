const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadPath = "uploads/leave";

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, {
    recursive: true,
  });
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadPath);
  },

  filename(req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

module.exports = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter(req, file, cb) {
    const allowed = ["image/jpeg", "image/png", "application/pdf"];

    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Format file tidak didukung."));
    }

    cb(null, true);
  },
});
