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

exports.leaveDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const supervisorId = req.user.id;

    const result = await pool.query(
      `
      SELECT

          lr.*,

          u.id AS employee_id,
          u.name,
          u.email,
          u.department,
          u.position,
          u.photo,
          u.leave_balance

      FROM leave_requests lr

      JOIN users u
      ON u.id = lr.user_id

      WHERE

          lr.id = $1

      AND

          u.supervisor_id = $2
      `,
      [id, supervisorId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Data tidak ditemukan.",
      });
    }

    const data = result.rows[0];

    const leaveDays =
      Math.ceil(
        (new Date(data.end_date) - new Date(data.start_date)) /
          (1000 * 60 * 60 * 24),
      ) + 1;

    data.leave_days = leaveDays;

    data.remaining_leave = Math.max(0, data.leave_balance - leaveDays);

    return res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
