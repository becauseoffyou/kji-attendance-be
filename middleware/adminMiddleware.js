module.exports = (req, res, next) => {
  const role = req.user.role?.toUpperCase();

  if (!["ADMIN", "HR"].includes(role)) {
    return res.status(403).json({
      success: false,
      message: "Akses ditolak",
    });
  }

  next();
};
