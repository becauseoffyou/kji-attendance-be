const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Folder upload
const photoDir = path.join(__dirname, "../uploads/photos");
const ktpDir = path.join(__dirname, "../uploads/ktp");

// Buat folder otomatis kalau belum ada
fs.mkdirSync(photoDir, { recursive: true });
fs.mkdirSync(ktpDir, { recursive: true });

// Storage foto
const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, photoDir);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);

    const filename = `photo-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

    cb(null, filename);
  },
});

// Storage KTP
const ktpStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, ktpDir);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);

    const filename = `ktp-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

    cb(null, filename);
  },
});

// Filter file
const imageFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp"];

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Format foto harus JPG, PNG, atau WEBP"));
  }
};

// Upload foto
const uploadPhoto = multer({
  storage: photoStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

// Upload KTP
const uploadKtp = multer({
  storage: ktpStorage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

module.exports = {
  uploadPhoto,
  uploadKtp,
};
