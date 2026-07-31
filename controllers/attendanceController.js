const fs = require("fs");
const pool = require("../config/db");
const haversine = require("../utils/haversine");

/*
|--------------------------------------------------------------------------
| TODAY
|--------------------------------------------------------------------------
*/

exports.today = async (req, res) => {
    try {

        const userId = req.user.id;

        const result = await pool.query(
            `
            SELECT *
            FROM attendance
            WHERE user_id = $1
            AND attendance_date = CURRENT_DATE
            LIMIT 1
            `,
            [userId]
        );

        if (result.rows.length === 0) {

            return res.json({
                success: true,
                data: {
                    checkIn: null,
                    checkOut: null,
                    status: "Belum Check In",
                    workingHours: null
                }
            });

        }

        const attendance = result.rows[0];

       let workingHours = null;

if (attendance.check_in) {

    const endTime = attendance.check_out
        ? new Date(attendance.check_out)
        : new Date();

    const diff = endTime - new Date(attendance.check_in);

    const hours = Math.floor(diff / (1000 * 60 * 60));

    const minutes = Math.floor(
        (diff % (1000 * 60 * 60)) / (1000 * 60)
    );

    workingHours = `${hours} Jam ${minutes} Menit`;

}
        return res.json({
            success: true,
            data: {
                checkIn: attendance.check_in,
                checkOut: attendance.check_out,
                status: attendance.status,
                workingHours
            }
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }
};

/*
|--------------------------------------------------------------------------
| HISTORY
|--------------------------------------------------------------------------
*/

exports.history = async (req, res) => {
    try {

        const userId = req.user.id;

        const result = await pool.query(
            `
            SELECT
                id,
                attendance_date,
                check_in,
                check_out,
                status,

                CASE
                    WHEN check_out IS NOT NULL THEN
                        justify_interval(check_out - check_in)::text
                    ELSE
                        '-'
                END AS working_hours

            FROM attendance

            WHERE user_id = $1

            ORDER BY attendance_date DESC
            `,
            [userId]
        );

        return res.json({
            success: true,
            data: result.rows
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }
};

/*
|--------------------------------------------------------------------------
| CHART
|--------------------------------------------------------------------------
*/

exports.chart = async (req, res) => {

    try {

        const userId = req.user.id;

        const result = await pool.query(
            `
            SELECT
                DATE(attendance_date) as date,
                status
            FROM attendance
            WHERE user_id=$1
            ORDER BY attendance_date
            `,
            [userId]
        );

        return res.json({
            success: true,
            data: result.rows
        });

    } catch (err) {

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

/*
|--------------------------------------------------------------------------
| CHECK IN
|--------------------------------------------------------------------------
*/

exports.checkIn = async (req, res) => {

    try {

        const userId = req.user.id;

        const {
            latitude,
            longitude
        } = req.body;

        if (!req.file) {

    return res.status(400).json({
        success: false,
        message: "Foto selfie wajib diambil."
    });

}

        if (!latitude || !longitude) {

            return res.status(400).json({
                success: false,
                message: "Latitude dan Longitude wajib diisi."
            });

        }

        // cek lokasi kantor user

        const officeResult = await pool.query(
            `
            SELECT o.*
            FROM users u
            JOIN office_locations o
            ON u.office_location_id=o.id
            WHERE u.id=$1
            `,
            [userId]
        );

        if (officeResult.rows.length === 0) {

            return res.status(400).json({
                success: false,
                message: "Lokasi kantor belum diatur."
            });

        }

        const office = officeResult.rows[0];

        // cek sudah check in

        const todayAttendance = await pool.query(
            `
            SELECT id
            FROM attendance
            WHERE user_id=$1
            AND attendance_date=CURRENT_DATE
            `,
            [userId]
        );

        if (todayAttendance.rows.length > 0) {

            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }

            return res.status(400).json({
                success: false,
                message: "Anda sudah Check In hari ini."
            });

        }

        // hitung jarak

        const distance = haversine(
            Number(latitude),
            Number(longitude),
            Number(office.latitude),
            Number(office.longitude)
        );

        if (distance > office.radius) {

            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }

            return res.status(400).json({
                success: false,
                message: "Anda berada di luar radius kantor.",
                distance: Math.round(distance),
                radius: office.radius
            });

        }

        const photoPath =
            req.file ? req.file.path : null;

        await pool.query(
            `
            INSERT INTO attendance
            (
                user_id,
                attendance_date,
                check_in,
                check_in_lat,
                check_in_lng,
                photo_path,
                status
            )
            VALUES
            (
                $1,
                CURRENT_DATE,
                NOW(),
                $2,
                $3,
                $4,
                'Hadir'
            )
            `,
            [
                userId,
                latitude,
                longitude,
                photoPath
            ]
        );

        return res.json({
            success: true,
            message: "Check In berhasil.",
            office: office.office_name,
            distance: Math.round(distance)
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

/*
|--------------------------------------------------------------------------
| CHECK OUT
|--------------------------------------------------------------------------
*/

exports.checkOut = async (req, res) => {

    try {

        const userId = req.user.id;

        const result = await pool.query(
            `
          UPDATE attendance
SET
    check_out = NOW(),
    status='Pulang'
WHERE
    user_id = $1
AND attendance_date = CURRENT_DATE
AND check_out IS NULL
RETURNING *
            `,
            [userId]
        );

        if (result.rows.length === 0) {

            return res.status(400).json({
                success: false,
                message: "Anda belum Check In."
            });

        }

        return res.json({
            success: true,
            message: "Check Out berhasil."
        });

    } catch (err) {

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

exports.list = async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT *
            FROM announcements
            WHERE
                is_active = TRUE
            ORDER BY sort_order ASC
        `);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};