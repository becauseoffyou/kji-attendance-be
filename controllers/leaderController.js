const pool = require("../config/db");

exports.leaveRequests = async (req, res) => {
  try {
    const supervisorId = req.user.id;

    const result = await pool.query(
      `
      SELECT

          lr.id,
          lr.leave_type,
          lr.start_date,
          lr.end_date,
          lr.reason,
          lr.attachment,
          lr.status,
          lr.created_at,

          u.id AS employee_id,
          u.name,
          u.email

      FROM leave_requests lr

      JOIN users u
      ON u.id = lr.user_id

      WHERE

          u.supervisor_id = $1

      AND

          lr.status = 'PENDING_SUPERVISOR'

      ORDER BY lr.created_at DESC
      `,
      [supervisorId],
    );

    return res.json({
      success: true,
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
