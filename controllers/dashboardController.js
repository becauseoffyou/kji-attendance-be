const pool = require("../config/db");

exports.getDashboard = async (req, res) => {
  try {
    const totalEmployee = await pool.query(`
            SELECT COUNT(*) AS total
            FROM users
            WHERE role_id = 3
              AND status = true
        `);

    const presentToday = await pool.query(`
    SELECT COUNT(*) AS total
    FROM attendance
    WHERE attendance_date = CURRENT_DATE
`);

    const attendanceToday = await pool.query(`
    SELECT
        a.id,
        u.name,
        u.department,
        a.check_in,
        a.check_out,
        a.status
    FROM attendance a
    JOIN users u
        ON u.id = a.user_id
    WHERE a.attendance_date = CURRENT_DATE
    ORDER BY a.check_in ASC
`);

    const attendanceChart = await pool.query(`
SELECT
    attendance_date,
    COUNT(*) AS total
FROM attendance
WHERE attendance_date >= CURRENT_DATE - INTERVAL '6 days'
GROUP BY attendance_date
ORDER BY attendance_date
`);
    const chart = attendanceChart.rows.map((item) => ({
      day: new Date(item.attendance_date).toLocaleDateString("id-ID", {
        weekday: "short",
      }),
      total: Number(item.total),
    }));

    console.log(chart);
    res.json({
      success: true,
      data: {
        totalEmployee: Number(totalEmployee.rows[0].total),
        present: Number(presentToday.rows[0].total),
        leave: 0,
        late: 0,
        chart,
        attendance: attendanceToday.rows,
      },
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
