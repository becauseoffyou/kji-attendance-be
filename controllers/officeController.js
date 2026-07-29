const pool = require("../config/db");
exports.currentOffice = async (req, res) => {

    try {
        const userId = req.user.id;

        const result = await pool.query(
            `
            SELECT
                o.id,
                o.office_name,
                o.latitude,
                o.longitude,
                o.radius
            FROM users u
            JOIN office_locations o
                ON u.office_location_id = o.id
            WHERE u.id = $1
            `,
            [userId]
        );

        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Lokasi kantor tidak ditemukan."
            });

        }

        return res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }

};