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
      SELECT
          *,
          CASE
              WHEN check_in IS NOT NULL THEN
                  CONCAT(
                      EXTRACT(HOUR FROM (COALESCE(check_out, NOW()) - check_in))::int,
                      ' Jam ',
                      EXTRACT(MINUTE FROM (COALESCE(check_out, NOW()) - check_in))::int,
                      ' Menit'
                  )
              ELSE NULL
          END AS working_hours
      FROM attendance
      WHERE user_id = $1
      AND attendance_date = CURRENT_DATE
      LIMIT 1
      `,
      [userId],
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          checkIn: null,
          checkOut: null,
          status: "Belum Check In",
          workingHours: null,
        },
      });
    }

    const attendance = result.rows[0];

    return res.json({
      success: true,
      data: {
        checkIn: attendance.check_in,
        checkOut: attendance.check_out,
        status: attendance.status,
        workingHours: attendance.working_hours,
      },
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
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

          check_in AT TIME ZONE 'Asia/Jakarta' AS check_in,
          check_out AT TIME ZONE 'Asia/Jakarta' AS check_out,

          status,
          attendance_type,
          notes,

          CASE
              WHEN (check_in AT TIME ZONE 'Asia/Jakarta')::time <= TIME '09:00:00'
              THEN 'Tepat Waktu'
              ELSE 'Terlambat'
          END AS attendance_status,

          CASE
              WHEN (check_in AT TIME ZONE 'Asia/Jakarta')::time > TIME '09:00:00'
              THEN FLOOR(
                  EXTRACT(
                      EPOCH FROM (
                          (check_in AT TIME ZONE 'Asia/Jakarta')::time - TIME '09:00:00'
                      )
                  ) / 60
              )::int
              ELSE 0
          END AS late_minutes,

          CASE
              WHEN check_out IS NOT NULL THEN
                  CONCAT(
                      EXTRACT(HOUR FROM (check_out - check_in))::int,
                      'j ',
                      EXTRACT(MINUTE FROM (check_out - check_in))::int,
                      'm'
                  )
              ELSE
                  '-'
          END AS working_hours

      FROM attendance

      WHERE user_id = $1

      ORDER BY attendance_date DESC
      `,
      [userId],
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
      [userId],
    );

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
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
      longitude,
      attendance_type = "OFFICE",
      notes = "",
    } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Foto selfie wajib diambil.",
      });
    }

    if (!latitude || !longitude) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(400).json({
        success: false,
        message: "Latitude dan Longitude wajib diisi.",
      });
    }

    // Ambil lokasi kantor user

    const officeResult = await pool.query(
      `
            SELECT o.*
            FROM users u
            JOIN office_locations o
                ON u.office_location_id = o.id
            WHERE u.id = $1
            `,
      [userId],
    );

    if (officeResult.rows.length === 0) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(400).json({
        success: false,
        message: "Lokasi kantor belum diatur.",
      });
    }

    const office = officeResult.rows[0];

    // Sudah check in hari ini?

    const todayAttendance = await pool.query(
      `
            SELECT id
            FROM attendance
            WHERE user_id = $1
            AND attendance_date = CURRENT_DATE
            `,
      [userId],
    );

    if (todayAttendance.rows.length > 0) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(400).json({
        success: false,
        message: "Anda sudah Check In hari ini.",
      });
    }

    // Hitung jarak

    const distance = haversine(
      Number(latitude),
      Number(longitude),
      Number(office.latitude),
      Number(office.longitude),
    );

    // Jenis absensi yang boleh di luar kantor

    const outsideAttendance = [
      "WFH",
      "CLIENT",
      "MEETING",
      "BUSINESS_TRIP",
      "OTHER",
    ];

    const allowOutsideOffice = outsideAttendance.includes(attendance_type);

    // Kalau OFFICE wajib dalam radius

    if (distance > Number(office.radius) && !allowOutsideOffice) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(400).json({
        success: false,
        message: "Anda berada di luar radius kantor.",
        distance: Math.round(distance),
        radius: office.radius,
      });
    }

    const photoPath = req.file.path;

    const officeStart = "09:00:00";

    const checkInTime = new Date();

    const jamMasuk = new Date();

    jamMasuk.setHours(9, 0, 0, 0);

    const isLate = checkInTime > jamMasuk;

    const lateMinutes = isLate
      ? Math.floor((checkInTime - jamMasuk) / 60000)
      : 0;

    // Simpan attendance

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
                attendance_type,
                notes,
                status,
                is_late,
late_minutes
            )
            VALUES
            (
                $1,
                CURRENT_DATE,
                NOW(),
                $2,
                $3,
                $4,
                $5,
                $6,
                'Hadir',
                $7,
                $8
            )
            `,
      [
        userId,
        latitude,
        longitude,
        photoPath,
        attendance_type,
        notes,
        isLate,
        lateMinutes,
      ],
    );

    return res.json({
      success: true,
      message: "Check In berhasil.",
      office: office.office_name,
      distance: Math.round(distance),
      attendance_type,
    });
  } catch (err) {
    console.error(err);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(500).json({
      success: false,
      message: err.message,
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

    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude dan Longitude wajib diisi.",
      });
    }

    const result = await pool.query(
      `
            UPDATE attendance
            SET
                check_out = NOW(),
                check_out_lat = $1,
                check_out_lng = $2,
                status = 'Pulang'
            WHERE
                user_id = $3
            AND attendance_date = CURRENT_DATE
            AND check_out IS NULL
            RETURNING *
            `,
      [latitude, longitude, userId],
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Anda belum Check In.",
      });
    }

    return res.json({
      success: true,
      message: "Check Out berhasil.",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
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
      data: result.rows,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

function getWorkingDays(year, month) {
  let total = 0;

  const lastDay = new Date(year, month, 0).getDate();

  for (let day = 1; day <= lastDay; day++) {
    const date = new Date(year, month - 1, day);

    const weekDay = date.getDay();

    // Minggu = 0
    // Sabtu = 6
    if (weekDay !== 0 && weekDay !== 6) {
      total++;
    }
  }

  return total;
}

async function getSummaryData(
  month,
  year,
  workingDays,
  department = "",
  search = "",
) {
  const result = await pool.query(
    `
            SELECT
                u.id,
                u.name,
                u.department,

                COUNT(a.id) AS present,

                SUM(
                    CASE
                        WHEN a.is_late = true THEN 1
                        ELSE 0
                    END
                ) AS late,

                SUM(
                    COALESCE(a.late_minutes, 0)
                ) AS late_minutes,
COALESCE(leave_summary.cuti,0) AS leave,

COALESCE(leave_summary.izin,0) AS permission,

COALESCE(leave_summary.sakit,0) AS sick,(
    COUNT(a.id)
    +
    COALESCE(leave_summary.cuti,0)
    +
    COALESCE(leave_summary.izin,0)
    +
    COALESCE(leave_summary.sakit,0)
) AS attendance_total,

GREATEST(

0,

$3
-
(
    COUNT(a.id)
    +
    COALESCE(leave_summary.cuti,0)
    +
    COALESCE(leave_summary.izin,0)
    +
    COALESCE(leave_summary.sakit,0)
)

) AS alpha,

ROUND(

(
(
COUNT(a.id)
+
COALESCE(leave_summary.cuti,0)
+
COALESCE(leave_summary.izin,0)
+
COALESCE(leave_summary.sakit,0)
)::numeric

/

NULLIF($3,0)

)*100

,2)

AS percent
            FROM users u
LEFT JOIN attendance a
ON
    a.user_id = u.id

AND EXTRACT(MONTH FROM a.attendance_date) = $1

AND EXTRACT(YEAR FROM a.attendance_date) = $2
                LEFT JOIN (

    SELECT

        user_id,

        SUM(
            CASE
                WHEN leave_type='CUTI'
                AND status='APPROVED'
                 AND approved_by IS NOT NULL
                THEN (end_date-start_date)+1
                ELSE 0
            END
        ) AS cuti,

        SUM(
            CASE
                WHEN leave_type='IZIN'
                AND status='APPROVED'
                 AND approved_by IS NOT NULL
                THEN (end_date-start_date)+1
                ELSE 0
            END
        ) AS izin,

        SUM(
            CASE
                WHEN leave_type='SAKIT'
                AND status='APPROVED'
                 AND approved_by IS NOT NULL
                THEN (end_date-start_date)+1
                ELSE 0
            END
        ) AS sakit

  FROM leave_requests

WHERE

EXTRACT(MONTH FROM start_date) = $1

AND

EXTRACT(YEAR FROM start_date) = $2

GROUP BY user_id

) leave_summary

ON leave_summary.user_id = u.id

           WHERE
    u.role_id = 3

AND
(
    $4 = ''
    OR u.department = $4
) AND
(
    $5 = ''

    OR LOWER(u.name)

    LIKE LOWER('%' || $5 || '%')
)

          GROUP BY
    u.id,
    u.name,
    u.department,
    leave_summary.cuti,
    leave_summary.izin,
    leave_summary.sakit

            ORDER BY
                u.name
        `,
    [month, year, workingDays, department || "", search || ""],
  );
  return result;
}

exports.getAttendanceSummary = async (req, res) => {
  const month = Number(req.query.month) || new Date().getMonth() + 1;

  const year = Number(req.query.year) || new Date().getFullYear();

  const department = req.query.department || "";

  const search = req.query.search || "";
  const workingDays = getWorkingDays(year, month);
  try {
    const result = await getSummaryData(
      month,

      year,

      workingDays,

      department,

      search,
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.getEmployeeAttendance = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
            SELECT

                attendance_date,

                check_in,

                check_out,

                status,

                is_late,

                late_minutes,

                attendance_type

            FROM attendance

            WHERE user_id = $1

           ORDER BY
    check_in DESC
        `,
      [id],
    );

    res.json({
      success: true,

      data: result.rows,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,

      message: err.message,
    });
  }
};

exports.getDailyAttendance = async (req, res) => {
  const {
    date,

    department,

    status,

    search,
  } = req.query;
  try {
    // kalau frontend tidak kirim tanggal,
    // otomatis pakai tanggal hari ini
    const queryDate = date || new Date().toISOString().slice(0, 10);
    const result = await pool.query(
      `
            
           SELECT

    u.id,

    u.name,

    u.department,

    a.check_in,

    a.check_out,

    COALESCE(a.status,'Belum Check In') AS status,

    COALESCE(a.is_late,false) AS is_late,

    COALESCE(a.late_minutes,0) AS late_minutes,

    a.photo_path,

    a.check_in_lat,

    a.check_in_lng

FROM users u

LEFT JOIN attendance a
ON
    a.user_id = u.id
AND
(
    $1::date IS NULL
    OR a.attendance_date = $1
)

WHERE
    u.role_id = 3

AND (
    $2 = ''
    OR u.department = $2
)

AND (
    $3 = ''
    OR COALESCE(a.status,'Belum Check In') = $3
)

AND (
    $4 = ''
    OR LOWER(u.name) LIKE LOWER('%' || $4 || '%')
)

ORDER BY u.name;

        `,
      [queryDate, department, status, search],
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

exports.getDepartments = async (req, res) => {
  try {
    const result = await pool.query(`
            SELECT DISTINCT department
            FROM users
            WHERE role_id = 3
              AND department IS NOT NULL
            ORDER BY department
        `);

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

exports.getEmployeeOfMonth = async (req, res) => {
  const month = Number(req.query.month) || new Date().getMonth() + 1;

  const year = Number(req.query.year) || new Date().getFullYear();

  const workingDays = getWorkingDays(year, month);

  try {
    const result = await getSummaryData(month, year, workingDays);

    const ranking = result.rows
      .sort((a, b) => {
        // Alpha paling sedikit
        if (Number(a.alpha) !== Number(b.alpha)) {
          return Number(a.alpha) - Number(b.alpha);
        }

        // Persentase paling tinggi
        if (Number(a.percent) !== Number(b.percent)) {
          return Number(b.percent) - Number(a.percent);
        }

        // Telat paling sedikit
        if (Number(a.late) !== Number(b.late)) {
          return Number(a.late) - Number(b.late);
        }

        // Menit telat paling sedikit
        if (Number(a.late_minutes) !== Number(b.late_minutes)) {
          return Number(a.late_minutes) - Number(b.late_minutes);
        }

        // Hadir paling banyak
        if (Number(a.present) !== Number(b.present)) {
          return Number(b.present) - Number(a.present);
        }

        return a.name.localeCompare(b.name);
      })
      .slice(0, 5);

    res.json({
      success: true,
      data: ranking,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.getDashboardSummary = async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const result = await pool.query(
      `
            SELECT

                COUNT(*) FILTER (
                    WHERE a.check_in IS NOT NULL
                ) AS hadir,

                COUNT(*) FILTER (
                    WHERE a.is_late = true
                ) AS terlambat,

                COUNT(*) FILTER (
                    WHERE a.check_in IS NOT NULL
                    AND a.check_out IS NULL
                ) AS belum_pulang,

                (
                    SELECT COUNT(*)
                    FROM users u
                    WHERE
                        u.role_id = 3
                        AND NOT EXISTS (
                            SELECT 1
                            FROM attendance x
                            WHERE
                                x.user_id = u.id
                                AND x.attendance_date = $1
                        )
                ) AS belum_checkin

            FROM attendance a

            WHERE a.attendance_date = $1
            `,
      [today],
    );

    return res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
