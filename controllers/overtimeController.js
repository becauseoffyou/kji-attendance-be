const pool = require("../config/db");


// =====================================================
// CREATE OVERTIME
// =====================================================

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


        // =========================
        // VALIDASI INPUT
        // =========================

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
                message:
                    "Jam mulai dan jam selesai tidak boleh sama.",
            });

        }


        // =========================
        // HITUNG DURASI
        // =========================

        const [startHour, startMinute] =
            start_time.split(":").map(Number);

        const [endHour, endMinute] =
            end_time.split(":").map(Number);


        let startTotal =
            startHour * 60 + startMinute;

        let endTotal =
            endHour * 60 + endMinute;


        // Lewat tengah malam
        if (endTotal < startTotal) {

            endTotal += 24 * 60;

        }


        const durationMinutes =
            endTotal - startTotal;


        if (durationMinutes <= 0) {

            return res.status(400).json({
                success: false,
                message:
                    "Durasi lembur tidak valid.",
            });

        }


        // =========================
        // AMBIL TARIF LEMBUR
        // =========================

        const settingResult =
            await pool.query(
                `
                SELECT
                    weekday_rate,
                    weekend_rate
                FROM overtime_settings
                ORDER BY id ASC
                LIMIT 1
                `
            );


        if (
            settingResult.rows.length === 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Pengaturan tarif lembur belum tersedia.",
            });

        }


        const weekdayRate =
            Number(
                settingResult.rows[0].weekday_rate
            );

        const weekendRate =
            Number(
                settingResult.rows[0].weekend_rate
            );


        // =========================
        // TENTUKAN HARI
        // =========================

        const overtimeDateObj =
            new Date(
                `${overtime_date}T00:00:00`
            );


        const day =
            overtimeDateObj.getDay();


        // 0 = Minggu
        // 6 = Sabtu

        const hourlyRate =
            day === 0 || day === 6
                ? weekendRate
                : weekdayRate;


        // =========================
        // HITUNG NOMINAL
        // PROPORSIONAL PER MENIT
        // =========================

        const overtimeAmount =
            (durationMinutes / 60) *
            hourlyRate;


        const finalOvertimeAmount =
            Number(
                overtimeAmount.toFixed(2)
            );


        // =========================
        // CEK ABSENSI
        // =========================

        let attendanceId =
            attendance_id || null;


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
        // CEK DUPLIKAT
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
        // INSERT OVERTIME
        // =========================

        const result =
            await pool.query(
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
                    status,
                    hourly_rate,
                    overtime_amount
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
                    'PENDING_MANAGER',
                    $8,
                    $9
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
                    hourlyRate,
                    finalOvertimeAmount,
                ],
            );


        const overtime =
            result.rows[0];


        // =====================================================
        // NOTIFICATION KE MANAGER
        // =====================================================

        const managerResult =
            await pool.query(
                `
                SELECT u.id
                FROM users u
                JOIN roles r
                    ON r.id = u.role_id
                WHERE UPPER(r.name) = 'MANAGER'
                `
            );


        for (
            const manager
            of managerResult.rows
        ) {

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
                    manager.id,

                    "Pengajuan Lembur Baru",

                    "Ada pengajuan lembur baru yang menunggu persetujuan Anda.",

                    "OVERTIME_PENDING",

                    overtime.id
                ]
            );

        }


        // =========================
        // RESPONSE
        // =========================

        return res.status(201).json({
            success: true,
            message:
                "Pengajuan lembur berhasil dikirim.",
            data: overtime,
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

// =====================================================
// EMPLOYEE HISTORY
// =====================================================

exports.history = async (req, res) => {

    try {

        const userId = req.user.id;


        const result =
            await pool.query(
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


// =====================================================
// APPROVE BY MANAGER
// =====================================================

exports.approveByManager = async (req, res) => {

    try {

        const overtimeId =
            req.params.id;


        const result =
            await pool.query(
                `
                UPDATE overtime_requests
                SET
                    status = 'APPROVED',
                    manager_id = $1,
                    manager_note = $2,
                    manager_approved_at = NOW(),
                    updated_at = NOW()
                WHERE id = $3
                  AND status = 'PENDING_MANAGER'
                RETURNING *
                `,
                [
                    req.user.id,
                    req.body.note || null,
                    overtimeId
                ]
            );


        if (result.rowCount === 0) {

            return res.status(400).json({
                success: false,
                message:
                    "Pengajuan tidak ditemukan atau sudah diproses."
            });

        }


        const overtime =
            result.rows[0];


        // =========================
        // NOTIFICATION KARYAWAN
        // =========================

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
                overtime.user_id,

                "Pengajuan Lembur Disetujui",

                "Pengajuan lembur Anda telah disetujui oleh Manager.",

                "OVERTIME_APPROVED",

                overtime.id
            ]
        );


        return res.json({
            success: true,
            message:
                "Pengajuan lembur berhasil disetujui.",
            data: overtime
        });


    } catch (err) {

        console.error(
            "APPROVE OVERTIME ERROR:",
            err
        );


        return res.status(500).json({
            success: false,
            message: err.message
        });

    }

};


// =====================================================
// REJECT BY MANAGER
// =====================================================

exports.rejectByManager = async (req, res) => {

    try {

        const overtimeId =
            req.params.id;

        const note =
            req.body.note?.trim();


        if (!note) {

            return res.status(400).json({
                success: false,
                message:
                    "Alasan penolakan wajib diisi."
            });

        }


        const result =
            await pool.query(
                `
                UPDATE overtime_requests
                SET
                    status = 'REJECTED',
                    manager_id = $1,
                    manager_note = $2,
                    manager_approved_at = NOW(),
                    updated_at = NOW()
                WHERE id = $3
                  AND status = 'PENDING_MANAGER'
                RETURNING *
                `,
                [
                    req.user.id,
                    note,
                    overtimeId
                ]
            );


        if (result.rowCount === 0) {

            return res.status(400).json({
                success: false,
                message:
                    "Pengajuan tidak ditemukan atau sudah diproses."
            });

        }


        const overtime =
            result.rows[0];


        // =========================
        // NOTIFICATION KARYAWAN
        // =========================

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
                overtime.user_id,

                "Pengajuan Lembur Ditolak",

                `Pengajuan lembur Anda ditolak oleh Manager. Alasan: ${note}`,

                "OVERTIME_REJECTED",

                overtime.id
            ]
        );


        return res.json({
            success: true,
            message:
                "Pengajuan lembur berhasil ditolak.",
            data: overtime
        });


    } catch (err) {

        console.error(
            "REJECT OVERTIME ERROR:",
            err
        );


        return res.status(500).json({
            success: false,
            message: err.message
        });

    }

};


// =====================================================
// MANAGER HISTORY
// =====================================================

exports.managerHistory = async (req, res) => {

    try {

        const result =
            await pool.query(
                `
                SELECT
                    o.id,
                    o.user_id,
                    u.name,
                    u.email,
                    o.overtime_date,
                    o.start_time,
                    o.end_time,
                    o.duration_minutes,
                    o.reason,
                    o.status,
                    o.created_at
                FROM overtime_requests o
                JOIN users u
                    ON u.id = o.user_id
              ORDER BY o.created_at DESC
                `
            );


        return res.json({
            success: true,
            data: result.rows
        });


    } catch (err) {

        console.error(
            "MANAGER OVERTIME HISTORY ERROR:",
            err
        );


        return res.status(500).json({
            success: false,
            message: err.message
        });

    }

};


// =====================================================
// MANAGER DETAIL
// =====================================================

exports.managerDetail = async (req, res) => {

    try {

        const result =
            await pool.query(
                `
                SELECT
                    o.*,
                    u.name,
                    u.email
                FROM overtime_requests o
                JOIN users u
                    ON u.id = o.user_id
                WHERE o.id = $1
                `,
                [req.params.id]
            );


        if (result.rowCount === 0) {

            return res.status(404).json({
                success: false,
                message:
                    "Pengajuan lembur tidak ditemukan."
            });

        }


        return res.json({
            success: true,
            data: result.rows[0]
        });


    } catch (err) {

        console.error(
            "MANAGER OVERTIME DETAIL ERROR:",
            err
        );


        return res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

// =====================================================
// MARK OVERTIME AS PAID
// =====================================================

exports.markAsPaid = async (req, res) => {

    try {

        const overtimeId = req.params.id;

        const result = await pool.query(
            `
            UPDATE overtime_requests
            SET
                payment_status = 'PAID',
                paid_at = NOW(),
                paid_by = $1
            WHERE id = $2
              AND status = 'APPROVED'
              AND payment_status = 'UNPAID'
            RETURNING *
            `,
            [
                req.user.id,
                overtimeId
            ]
        );


        if (result.rowCount === 0) {

            return res.status(400).json({
                success: false,
                message:
                    "Pengajuan lembur tidak ditemukan, belum disetujui, atau sudah dibayar."
            });

        }


        return res.json({
            success: true,
            message:
                "Pembayaran lembur berhasil dicatat.",
            data: result.rows[0]
        });


    } catch (err) {

        console.error(
            "MARK OVERTIME PAID ERROR:",
            err
        );


        return res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

exports.getAdminRecap = async (req, res) => {
    try {

        const {
            page = 1,
            limit = 10,
            name = "",
            department = "",
            start_date = "",
            end_date = "",
            sort = "latest"
        } = req.query;


        // =====================================
        // PAGINATION
        // =====================================

        const pageNumber =
            Math.max(parseInt(page) || 1, 1);

        const limitNumber =
            Math.min(
                Math.max(parseInt(limit) || 10, 1),
                100
            );

        const offset =
            (pageNumber - 1) * limitNumber;


        // =====================================
        // FILTER
        // =====================================

        const conditions = [];

        const values = [];

        let paramIndex = 1;


        // =====================================
        // NAMA
        // =====================================

        if (name.trim()) {

            conditions.push(
                `u.name ILIKE $${paramIndex}`
            );

            values.push(
                `%${name.trim()}%`
            );

            paramIndex++;

        }


        // =====================================
        // DEPARTMENT
        // =====================================

        if (department.trim()) {

            conditions.push(
                `u.department = $${paramIndex}`
            );

            values.push(
                department.trim()
            );

            paramIndex++;

        }


        // =====================================
        // TANGGAL MULAI
        // =====================================

        if (start_date) {

            conditions.push(
                `o.overtime_date >= $${paramIndex}`
            );

            values.push(
                start_date
            );

            paramIndex++;

        }


        // =====================================
        // TANGGAL SELESAI
        // =====================================

        if (end_date) {

            conditions.push(
                `o.overtime_date <= $${paramIndex}`
            );

            values.push(
                end_date
            );

            paramIndex++;

        }


        // =====================================
        // WHERE
        // =====================================

        const whereClause =
            conditions.length > 0
                ? `WHERE ${conditions.join(" AND ")}`
                : "";


        // =====================================
        // SORTING
        // =====================================

        const orderClause =
            sort === "oldest"
                ? `
                    o.overtime_date ASC,
                    o.id ASC
                  `
                : `
                    o.overtime_date DESC,
                    o.id DESC
                  `;


        // =====================================
        // TOTAL DATA
        // =====================================

        const countResult =
            await pool.query(
                `
                SELECT
                    COUNT(*)::int AS total

                FROM overtime_requests o

                JOIN users u
                    ON u.id = o.user_id

                ${whereClause}
                `,
                values
            );


        const total =
            countResult.rows[0].total;


        // =====================================
        // SUMMARY
        //
        // Hanya lembur APPROVED
        // yang masuk perhitungan tagihan
        // =====================================

        const summaryResult =
            await pool.query(
                `
                SELECT

                    COUNT(*) FILTER (
                        WHERE o.status = 'APPROVED'
                    )::int AS approved_count,


                    COALESCE(
                        SUM(
                            o.duration_minutes
                        ) FILTER (
                            WHERE o.status = 'APPROVED'
                        ),
                        0
                    )::int AS approved_minutes,


                    COALESCE(
                        SUM(
                            o.overtime_amount
                        ) FILTER (
                            WHERE o.status = 'APPROVED'
                        ),
                        0
                    )::numeric AS total_bill,


                    COALESCE(
                        SUM(
                            o.overtime_amount
                        ) FILTER (
                            WHERE
                                o.status = 'APPROVED'
                                AND o.payment_status = 'UNPAID'
                        ),
                        0
                    )::numeric AS unpaid_bill,


                    COALESCE(
                        SUM(
                            o.overtime_amount
                        ) FILTER (
                            WHERE
                                o.status = 'APPROVED'
                                AND o.payment_status = 'PAID'
                        ),
                        0
                    )::numeric AS paid_bill


                FROM overtime_requests o

                JOIN users u
                    ON u.id = o.user_id

                ${whereClause}
                `,
                values
            );


        const summary =
            summaryResult.rows[0];


        // =====================================
        // DATA REKAP
        // =====================================

        const dataValues = [
            ...values,
            limitNumber,
            offset
        ];


        const result =
            await pool.query(
                `
                SELECT

                    o.id,

                    o.overtime_date,

                    o.start_time,

                    o.end_time,

                    o.duration_minutes,

                    o.reason,

                    o.status,

                    o.payment_status,

                    o.paid_at,

                    o.paid_by,

                    o.hourly_rate,

                    o.overtime_amount,


                    u.id AS user_id,

                    u.name AS employee_name,

                    u.department


                FROM overtime_requests o


                JOIN users u
                    ON u.id = o.user_id


                ${whereClause}


                ORDER BY
                    ${orderClause}


                LIMIT $${paramIndex}

                OFFSET $${paramIndex + 1}
                `,
                dataValues
            );


        // =====================================
        // KONVERSI SUMMARY
        // =====================================

        const approvedMinutes =
            Number(
                summary.approved_minutes || 0
            );


        const totalHours =
            Math.floor(
                approvedMinutes / 60
            );


        const totalMinutes =
            approvedMinutes % 60;


        // =====================================
        // PAGINATION
        // =====================================

        const totalPages =
            Math.ceil(
                total / limitNumber
            );


        // =====================================
        // RESPONSE
        // =====================================

        return res.json({

            success: true,

            data: result.rows,

            summary: {

                approved_count:
                    Number(
                        summary.approved_count || 0
                    ),

                total_minutes:
                    approvedMinutes,

                total_hours:
                    totalHours,

                total_remaining_minutes:
                    totalMinutes,

                total_bill:
                    Number(
                        summary.total_bill || 0
                    ),

                unpaid_bill:
                    Number(
                        summary.unpaid_bill || 0
                    ),

                paid_bill:
                    Number(
                        summary.paid_bill || 0
                    )

            },

            pagination: {

                page: pageNumber,

                limit: limitNumber,

                total,

                totalPages

            }

        });


    } catch (err) {

        console.error(
            "GET OVERTIME ADMIN RECAP ERROR:",
            err
        );


        return res.status(500).json({

            success: false,

            message: err.message

        });

    }
};

// =====================================================
// GET OVERTIME SETTINGS
// =====================================================

exports.getOvertimeSettings = async (req, res) => {
    try {

        const result = await pool.query(`
            SELECT
                id,
                weekday_rate,
                weekend_rate,
                created_at,
                updated_at
            FROM overtime_settings
            ORDER BY id ASC
            LIMIT 1
        `);

        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message: "Pengaturan tarif lembur belum tersedia."
            });

        }

        return res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (err) {

        console.error(
            "GET OVERTIME SETTINGS ERROR:",
            err
        );

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }
};


// =====================================================
// UPDATE OVERTIME SETTINGS
// =====================================================

exports.updateOvertimeSettings = async (req, res) => {
    try {

        const {
            weekday_rate,
            weekend_rate
        } = req.body;


        // =====================================
        // VALIDASI
        // =====================================

        if (
            weekday_rate === undefined ||
            weekend_rate === undefined
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Tarif weekday dan weekend wajib diisi."
            });

        }


        const weekdayRate =
            Number(weekday_rate);

        const weekendRate =
            Number(weekend_rate);


        if (
            !Number.isFinite(weekdayRate) ||
            !Number.isFinite(weekendRate)
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Tarif harus berupa angka."
            });

        }


        if (
            weekdayRate < 0 ||
            weekendRate < 0
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Tarif tidak boleh kurang dari 0."
            });

        }


        // =====================================
        // UPDATE
        // =====================================

        const result = await pool.query(
            `
            UPDATE overtime_settings
            SET
                weekday_rate = $1,
                weekend_rate = $2,
                updated_at = NOW()
            WHERE id = (
                SELECT id
                FROM overtime_settings
                ORDER BY id ASC
                LIMIT 1
            )
            RETURNING
                id,
                weekday_rate,
                weekend_rate,
                created_at,
                updated_at
            `,
            [
                weekdayRate,
                weekendRate
            ]
        );


        if (result.rows.length === 0) {

            return res.status(404).json({
                success: false,
                message:
                    "Pengaturan tarif lembur belum tersedia."
            });

        }


        return res.json({
            success: true,
            message:
                "Pengaturan tarif lembur berhasil diperbarui.",
            data: result.rows[0]
        });


    } catch (err) {

        console.error(
            "UPDATE OVERTIME SETTINGS ERROR:",
            err
        );

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }
};

exports.myRecap = async (req, res) => {
    try {

        const userId = req.user.id;

        // =====================================
        // AMBIL DATA LEMBUR USER
        // =====================================

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
                o.payment_status,
                o.paid_at,
                o.hourly_rate,
                o.overtime_amount

            FROM overtime_requests o

            WHERE o.user_id = $1

            ORDER BY
                o.overtime_date DESC,
                o.id DESC
            `,
            [userId]
        );


        // =====================================
        // SUMMARY
        // =====================================

        const summaryResult = await pool.query(
            `
            SELECT

                COUNT(*) FILTER (
                    WHERE status = 'APPROVED'
                )::int AS approved_count,

                COALESCE(
                    SUM(duration_minutes)
                    FILTER (
                        WHERE status = 'APPROVED'
                    ),
                    0
                )::int AS total_minutes,

                COALESCE(
                    SUM(overtime_amount)
                    FILTER (
                        WHERE status = 'APPROVED'
                    ),
                    0
                )::numeric AS total_bill,

                COALESCE(
                    SUM(overtime_amount)
                    FILTER (
                        WHERE
                            status = 'APPROVED'
                            AND payment_status = 'UNPAID'
                    ),
                    0
                )::numeric AS unpaid_bill,

                COALESCE(
                    SUM(overtime_amount)
                    FILTER (
                        WHERE
                            status = 'APPROVED'
                            AND payment_status = 'PAID'
                    ),
                    0
                )::numeric AS paid_bill

            FROM overtime_requests

            WHERE user_id = $1
            `,
            [userId]
        );


        const summary =
            summaryResult.rows[0];


        const totalMinutes =
            Number(
                summary.total_minutes || 0
            );


        const totalHours =
            Math.floor(
                totalMinutes / 60
            );


        const remainingMinutes =
            totalMinutes % 60;


        return res.json({

            success: true,

            data: result.rows,

            summary: {

                approved_count:
                    Number(
                        summary.approved_count || 0
                    ),

                total_minutes:
                    totalMinutes,

                total_hours:
                    totalHours,

                total_remaining_minutes:
                    remainingMinutes,

                total_bill:
                    Number(
                        summary.total_bill || 0
                    ),

                unpaid_bill:
                    Number(
                        summary.unpaid_bill || 0
                    ),

                paid_bill:
                    Number(
                        summary.paid_bill || 0
                    )

            }

        });


    } catch (err) {

        console.error(
            "GET MY OVERTIME RECAP ERROR:",
            err
        );


        return res.status(500).json({

            success: false,

            message:
                err.message

        });

    }
};