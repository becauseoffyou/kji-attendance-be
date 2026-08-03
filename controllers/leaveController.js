const pool = require("../config/db");
const fs = require("fs");

exports.create = async (req, res) => {
  try {
    const userId = req.user.id;

    const { leave_type, start_date, end_date, reason } = req.body;

    if (!leave_type || !start_date || !end_date) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(400).json({
        success: false,
        message: "Data belum lengkap.",
      });
    }

    const attachment = req.file ? req.file.path : null;

    await pool.query(
      `
            INSERT INTO leave_requests
            (
                user_id,
                leave_type,
                start_date,
                end_date,
                reason,
                attachment
            )
            VALUES
            (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6
            )
            `,
      [userId, leave_type, start_date, end_date, reason, attachment],
    );

    return res.json({
      success: true,
      message: "Pengajuan berhasil dikirim.",
    });
  } catch (err) {
    console.error(err);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
