const pool = require("../config/db");

exports.create = async (req, res) => {
    try {
        const userId = req.user.id;

        const {
            overtime_date,
            start_time,
            end_time,
            reason,
            attendance_id,
        } = req.body;

        if (
            !overtime_date ||
            !start_time ||
            !end_time ||
            !reason
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Tanggal, jam mulai, jam selesai, dan alasan wajib diisi.",
            });
        }

        // =========================
        // VALIDASI JAM
        // =========================

        if (end_time === start_time) {
            return res.status(400).json({
                success: false,
                message: "Jam mulai dan jam selesai tidak boleh sama.",
            });
        }
        // =========================
        // HITUNG DURASI
        // =========================

        // =========================
        // HITUNG DURASI LEMBUR
        // =========================

        const [startHour, startMinute] =
            start_time.split(":").map(Number);

        const [endHour, endMinute] =
            end_time.split(":").map(Number);

        let startTotal =
            startHour * 60 + startMinute;

        let endTotal =
            endHour * 60 + endMinute;

        // Kalau selesai lebih kecil,
        // berarti lembur melewati tengah malam
        if (endTotal < startTotal) {
            endTotal += 24 * 60;
        }

        const durationMinutes =
            endTotal - startTotal;

        if (durationMinutes <= 0) {
            return res.status(400).json({
                success: false,
                message: "Durasi lembur tidak valid.",
            });
        }

        // =========================
        // CEK ABSENSI
        // =========================

        let attendanceId = attendance_id || null;

        if (!attendanceId) {

            const attendanceResult =
                await pool.query(
                    `
                    SELECT id
                    FROM attendance
                    WHERE user_id = $1
                      AND attendance_date = $2
                    LIMIT 1
                    `,
                    [
                        userId,
                        overtime_date,
                    ],
                );

            if (
                attendanceResult.rows.length > 0
            ) {
                attendanceId =
                    attendanceResult.rows[0].id;
            }
        }

        // =========================
        // CEK PENGAJUAN DUPLIKAT
        // =========================

        const duplicate =
            await pool.query(
                `
                SELECT id
                FROM overtime_requests
                WHERE user_id = $1
                  AND overtime_date = $2
                  AND status IN (
                      'PENDING_SUPERVISOR',
                      'PENDING_MANAGER',
                      'APPROVED'
                  )
                LIMIT 1
                `,
                [
                    userId,
                    overtime_date,
                ],
            );

        if (duplicate.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message:
                    "Anda sudah memiliki pengajuan lembur pada tanggal tersebut.",
            });
        }

        // =========================
        // INSERT
        // =========================

        const result = await pool.query(
            `
            INSERT INTO overtime_requests
            (
                user_id,
                attendance_id,
                overtime_date,
                start_time,
                end_time,
                duration_minutes,
                reason,
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
                'PENDING_SUPERVISOR'
            )
            RETURNING *
            `,
            [
                userId,
                attendanceId,
                overtime_date,
                start_time,
                end_time,
                durationMinutes,
                reason,
            ],
        );

        return res.status(201).json({
            success: true,
            message:
                "Pengajuan lembur berhasil dikirim.",
            data: result.rows[0],
        });

    } catch (err) {

        console.error(
            "CREATE OVERTIME ERROR:",
            err,
        );

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
                o.id,
                o.overtime_date,
                o.start_time,
                o.end_time,
                o.duration_minutes,
                o.reason,
                o.status,
                o.supervisor_note,
                o.manager_note,
                o.created_at
            FROM overtime_requests o
            WHERE o.user_id = $1
            ORDER BY
                o.overtime_date DESC,
                o.created_at DESC
            `,
            [userId]
        );

        return res.json({
            success: true,
            data: result.rows
        });

    } catch (err) {

        console.error(
            "OVERTIME HISTORY ERROR:",
            err
        );

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};