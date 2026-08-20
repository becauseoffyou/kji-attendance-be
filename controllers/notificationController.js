const pool = require("../config/db");

exports.badge = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `
      SELECT COUNT(*)::int AS total
      FROM notifications
      WHERE
        user_id = $1
        AND is_read = false
      `,
      [userId],
    );

    return res.json({
      success: true,
      badge: result.rows[0].total,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.readPendingLeave = async (req, res) => {
  try {
    await pool.query(
      `
            UPDATE notifications

            SET is_read = true

            WHERE
                user_id = $1

                AND type IN (
    'LEAVE_PENDING',
    'ATTENDANCE_EDIT_PENDING',
    'OVERTIME_PENDING'
)

                AND is_read = false
            `,
      [req.user.id],
    );

    return res.json({
      success: true,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.readLeaveResult = async (req, res) => {
  try {
    await pool.query(
      `
            UPDATE notifications

            SET is_read = true

            WHERE
                user_id = $1

                AND type IN (
                    'LEAVE_APPROVED',
                    'LEAVE_REJECTED',
                    'ATTENDANCE_EDIT_APPROVED',
                    'ATTENDANCE_EDIT_REJECTED'
                )

                AND is_read = false
            `,
      [req.user.id],
    );

    return res.json({
      success: true,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
