module.exports = (req, res, next) => {

    if (req.user.role !== 1) {

        return res.status(403).json({
            success: false,
            message: "Akses ditolak"
        });

    }

    next();

};