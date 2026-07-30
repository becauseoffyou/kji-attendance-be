const pool = require("../config/db");

exports.getDashboard = async (req, res) => {

    try {

        const totalEmployee = await pool.query(`
            SELECT COUNT(*) AS total
            FROM users
            WHERE role_id = 2
              AND status = true
        `);

        res.json({
            success: true,
            data: {
                totalEmployee: Number(totalEmployee.rows[0].total),
                present: 0,
                leave: 0,
                late: 0,
                chart: [],
                attendance: []
            }
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};