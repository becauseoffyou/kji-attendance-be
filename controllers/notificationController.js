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
