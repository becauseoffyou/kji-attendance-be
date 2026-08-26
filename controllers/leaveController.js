const pool = require("../config/db");
const fs = require("fs");

exports.create = async (req, res) => {
  try {
    const userId = req.user.id;

    const { leave_type, leave_category, start_date, end_date, reason } = req.body;

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

    const leaveResult = await pool.query(
      `
  INSERT INTO leave_requests
  (
      user_id,
      leave_type,
      leave_category,
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
    $7,
    $8
  )
  RETURNING id
  `,
      [
        userId,

        leave_type,

        leave_type === "CUTI"
          ? leave_category
          : null,

        start_date,

        end_date,

        reason,

        attachment,

        "PENDING_SUPERVISOR",
      ],
    );

    const employee = await pool.query(
      `
  SELECT
      name,
      supervisor_id
  FROM users
  WHERE id = $1
  `,
      [userId],
    );

    const supervisor = employee.rows[0];

    await pool.query(
      `
  INSERT INTO notifications
  (
      user_id,
      title,
      message,
      type,
      reference_id
  )
  VALUES
  (
      $1,
      $2,
      $3,
      $4,
      $5
  )
  `,
      [
        supervisor.supervisor_id,
        "Pengajuan Baru",
        `${supervisor.name} mengajukan ${leave_type}.`,
        "LEAVE_PENDING",
        leaveResult.rows[0].id,
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
    leave_category,
    start_date,
    end_date,
    reason,
    attachment,
    status,
    approval_note,
    created_at,

    'LEAVE' AS request_type,

    NULL::timestamp AS old_check_in,
    NULL::timestamp AS new_check_in,
    NULL::timestamp AS old_check_out,
    NULL::timestamp AS new_check_out
FROM leave_requests
WHERE user_id = $1


            UNION ALL


            SELECT
                aer.id,

                'PERUBAHAN ABSENSI' AS leave_type,

                a.attendance_date AS start_date,
                a.attendance_date AS end_date,

                aer.reason,

                NULL::text AS attachment,

                CASE
                    WHEN aer.status = 'PENDING'
                        THEN 'PENDING_SUPERVISOR'
                    ELSE aer.status
                END AS status,

                CASE
                    WHEN aer.status = 'REJECTED'
                        THEN aer.rejection_reason
                    ELSE NULL
                END AS approval_note,

                aer.created_at,

                'ATTENDANCE_EDIT' AS request_type,

                aer.old_check_in,
                aer.new_check_in,
                aer.old_check_out,
                aer.new_check_out

            FROM attendance_edit_requests aer

            JOIN attendance a
                ON a.id = aer.attendance_id

            WHERE aer.user_id = $1


            ORDER BY created_at DESC
            `,
      [userId],
    );

    // =========================
    // SALDO CUTI
    // =========================

    const balance = await pool.query(
      `
            SELECT leave_balance

            FROM users

            WHERE id = $1
            `,
      [userId],
    );

    return res.json({
      success: true,

      summary: {
        leave_balance: balance.rows[0]?.leave_balance || 0,
      },

      data: result.rows,
    });
  } catch (err) {
    console.error("LEAVE HISTORY ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
