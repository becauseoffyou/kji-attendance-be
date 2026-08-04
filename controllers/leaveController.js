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

    if (req.file) {
      console.log("EXISTS:", fs.existsSync(req.file.path), req.file.path);
    }
    const today = new Date().toISOString().split("T")[0];

    if (start_date < today) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(400).json({
        success: false,
        message: "Tanggal pengajuan tidak boleh sebelum hari ini.",
      });
    }
    if (end_date < start_date) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(400).json({
        success: false,
        message: "Tanggal selesai tidak valid.",
      });
    }

    const exists = await pool.query(
      `
SELECT id
FROM leave_requests
WHERE
user_id = $1
AND status = 'PENDING_SUPERVISOR'
AND (
    start_date <= $3
    AND end_date >= $2
)
`,
      [userId, start_date, end_date],
    );

    if (exists.rows.length > 0) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(400).json({
        success: false,
        message: "Masih ada pengajuan pada rentang tanggal tersebut.",
      });
    }
    await pool.query(
      `
         INSERT INTO leave_requests
(
    user_id,
    leave_type,
    start_date,
    end_date,
    reason,
    attachment,
    status
)
VALUES
(
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7
)
            `,
      [
        userId,
        leave_type,
        start_date,
        end_date,
        reason,
        attachment,
        "PENDING_SUPERVISOR",
      ],
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

exports.history = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `
    SELECT
      id,
      leave_type,
      start_date,
      end_date,
      reason,
      attachment,
      status,
      created_at
    FROM leave_requests
    WHERE user_id = $1
    ORDER BY created_at DESC
  `,
      [userId],
    );

    const balance = await pool.query(
      `
    SELECT leave_balance
    FROM users
    WHERE id = $1
  `,
      [userId],
    );

    console.log(result.rows);
    console.log(balance.rows);

    return res.json({
      success: true,

      summary: {
        leave_balance: balance.rows[0].leave_balance,
      },

      data: result.rows,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
