const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      `
    SELECT

        u.*,

        r.name AS role_name

    FROM users u

    JOIN roles r
    ON r.id = u.role_id

    WHERE u.email = $1
    `,
      [email],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Email tidak ditemukan",
      });
    }

    const user = result.rows[0];

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(401).json({
        success: false,
        message: "Password salah",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        role_id: user.role_id,
        role: user.role_name,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      },
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,

        role_id: user.role_id,
        role: user.role_name,
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

exports.me = async (req, res) => {
  try {
    const result = await pool.query(
      `
SELECT

u.id,
u.role_id,

r.name AS role,

u.nik,
u.name,
u.email,
u.department,
u.position,
u.photo,
u.status

FROM users u

JOIN roles r
ON r.id=u.role_id

WHERE u.id=$1
`,
      [req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan",
      });
    }

    res.json({
      success: true,
      user: result.rows[0],
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

exports.createEmployee = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      nik,
      name,
      email,
      phone,
      department,
      position,
      join_date,
      address,
      employee_type,
      contract_start_date,
      contract_end_date,
      office_location_id,
      supervisor_id,
    } = req.body;

    // =========================
    // VALIDASI
    // =========================

    if (!nik || !name || !email || !department) {
      return res.status(400).json({
        success: false,
        message: "NIK, nama, email, dan departemen wajib diisi",
      });
    }

    if (!/^\d{16}$/.test(nik)) {
      return res.status(400).json({
        success: false,
        message: "NIK harus terdiri dari 16 digit",
      });
    }

    // =========================
    // CEK NIK / EMAIL
    // =========================

    const existing = await pool.query(
      `
            SELECT id
            FROM users
            WHERE nik = $1
               OR email = $2
            LIMIT 1
            `,
      [nik, email],
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "NIK atau email sudah terdaftar",
      });
    }

    // =========================
    // PASSWORD DEFAULT
    // kji + 4 digit terakhir NIK
    // =========================

    const defaultPassword = `kji${nik.slice(-4)}`;

    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // =========================
    // FILE
    // =========================

    const photo = req.files?.photo?.[0];
    const ktp = req.files?.ktp?.[0];

    const photoPath = photo ? `/uploads/photos/${photo.filename}` : null;

    const ktpPath = ktp ? `/uploads/ktp/${ktp.filename}` : null;

    // =========================
    // TRANSACTION
    // =========================

    await client.query("BEGIN");

    const result = await client.query(
      `
            INSERT INTO users (
                role_id,
                nik,
                name,
                email,
                password,
                phone,
                department,
                position,
                photo,
                ktp,
                join_date,
                address,
                status,
                employee_type,
                contract_start_date,
                contract_end_date,
                office_location_id,
                supervisor_id
            )
            VALUES (
                3,
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,
                $11,
                true,
                $12,
                $13,
                $14,
                $15,
                $16
            )
            RETURNING
                id,
                nik,
                name,
                email,
                phone,
                department,
                position,
                photo,
                ktp,
                join_date,
                address,
                status,
                employee_type,
                contract_start_date,
                contract_end_date
            `,
      [
        nik,
        name,
        email,
        hashedPassword,
        phone || null,
        department,
        position || null,
        photoPath,
        ktpPath,
        join_date || null,
        address || null,
        employee_type || "TETAP",
        contract_start_date || null,
        contract_end_date || null,
        office_location_id || null,
        supervisor_id || null,
      ],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Karyawan berhasil dibuat",
      data: result.rows[0],
    });
  } catch (err) {
    await client.query("ROLLBACK");

    console.error("CREATE EMPLOYEE ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Gagal membuat karyawan",
    });
  } finally {
    client.release();
  }
};

exports.getEmployees = async (req, res) => {
  try {
    const result = await pool.query(`
            SELECT
                u.id,
                u.nik,
                u.name,
                u.email,
                u.phone,
                u.department,
                u.position,
                u.photo,
                u.status,
                u.employee_type,
                u.contract_start_date,
                u.contract_end_date,
                u.join_date,
                u.address,
                u.office_location_id,
                u.supervisor_id,
                u.ktp
            FROM users u
            WHERE u.role_id = 3
            ORDER BY u.name ASC
        `);

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error("GET EMPLOYEES ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil data karyawan",
    });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      nik,
      name,
      email,
      phone,
      department,
      position,
      join_date,
      address,
      employee_type,
      contract_start_date,
      contract_end_date,
      office_location_id,
      supervisor_id,
    } = req.body;

    const photo = req.files?.photo?.[0];
    const ktp = req.files?.ktp?.[0];

    const photoPath = photo ? `/uploads/photos/${photo.filename}` : null;

    const ktpPath = ktp ? `/uploads/ktp/${ktp.filename}` : null;

    const result = await pool.query(
      `
            UPDATE users
            SET
                nik = $1,
                name = $2,
                email = $3,
                phone = $4,
                department = $5,
                position = $6,
                join_date = $7,
                address = $8,
                employee_type = $9,
                contract_start_date = $10,
                contract_end_date = $11,
                office_location_id = $12,
                supervisor_id = $13,

                photo = COALESCE($14, photo),
                ktp = COALESCE($15, ktp),

                updated_at = NOW()

            WHERE id = $16
              AND role_id = 3

            RETURNING
                id,
                nik,
                name,
                email,
                phone,
                department,
                position,
                join_date,
                address,
                employee_type,
                contract_start_date,
                contract_end_date,
                office_location_id,
                supervisor_id,
                photo,
                ktp,
                status
            `,
      [
        nik,
        name,
        email,
        phone,
        department,
        position,
        join_date || null,
        address,
        employee_type,
        employee_type === "KONTRAK" ? contract_start_date || null : null,
        employee_type === "KONTRAK" ? contract_end_date || null : null,
        office_location_id || null,
        supervisor_id || null,
        photoPath,
        ktpPath,
        id,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Karyawan tidak ditemukan",
      });
    }

    return res.json({
      success: true,
      message: "Data karyawan berhasil diperbarui",
      data: result.rows[0],
    });
  } catch (err) {
    console.error("UPDATE EMPLOYEE ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Gagal memperbarui data karyawan",
    });
  }
};

exports.deactivateEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
            UPDATE users
            SET
                status = false,
                updated_at = NOW()
            WHERE id = $1
              AND role_id = 3
            RETURNING
                id,
                name,
                email,
                status
            `,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Karyawan tidak ditemukan",
      });
    }

    return res.json({
      success: true,
      message: "Karyawan berhasil dinonaktifkan",
      data: result.rows[0],
    });
  } catch (err) {
    console.error("DEACTIVATE EMPLOYEE ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Gagal menonaktifkan karyawan",
    });
  }
};

exports.activateEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
            UPDATE users
            SET
                status = true,
                updated_at = NOW()
            WHERE id = $1
              AND role_id = 3
            RETURNING
                id,
                name,
                email,
                status
            `,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Karyawan tidak ditemukan",
      });
    }

    return res.json({
      success: true,
      message: "Karyawan berhasil diaktifkan",
      data: result.rows[0],
    });
  } catch (err) {
    console.error("ACTIVATE EMPLOYEE ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Gagal mengaktifkan karyawan",
    });
  }
};
