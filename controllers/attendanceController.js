const pool = require("../config/db");
const haversine = require("../utils/haversine");
const office = await pool.query(
  `
SELECT
    o.*
FROM users u
JOIN office_locations o
ON u.office_location_id = o.id
WHERE u.id=$1
`,
  [userId],
);
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

    let workingHours = null;

    if (attendance.check_in && attendance.check_out) {
      const diffMs =
        new Date(attendance.check_out) - new Date(attendance.check_in);

      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      workingHours = `${hours} Jam ${minutes} Menit`;
    }

    res.json({
      success: true,
      data: {
        checkIn: attendance.check_in,
        checkOut: attendance.check_out,
        status: attendance.status,
        workingHours,
      },
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
exports.history = async (req, res) => {
  res.json({
    success: true,
    data: [],
  });
};

exports.chart = async (req, res) => {
  res.json({
    success: true,
    data: [],
  });
};

exports.checkIn = async (req, res) => {
  try {
    const userId = req.user.id;

    const { latitude, longitude } = req.body;

    const photoPath = req.file ? req.file.path : null;

    const today = new Date().toISOString().split("T")[0];

    const now = new Date();

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
            ($1,$2,$3,$4,$5,$6,$7)
            `,
      [userId, today, now, latitude, longitude, photoPath, "Hadir"],
    );

    res.json({
      success: true,
      message: "Check In berhasil",
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.checkOut = async (req, res) => {
  res.json({
    success: true,
    message: "Check Out berhasil",
  });
};
