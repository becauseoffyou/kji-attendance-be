const pool = require("../config/db");

// =====================================
// GET ACTIVE ANNOUNCEMENTS
// UNTUK SLIDER APLIKASI KARYAWAN
// =====================================

exports.getActiveAnnouncements = async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT
        id,
        title,
        description,
        image_url,
        button_text,
        button_link,
        sort_order,
        start_date,
        end_date,
        url
      FROM announcements
      WHERE is_active = true
        AND (
          start_date IS NULL
          OR start_date <= CURRENT_DATE
        )
        AND (
          end_date IS NULL
          OR end_date >= CURRENT_DATE
        )
    ORDER BY created_at DESC
    `);

    return res.status(200).json({
      success: true,
      data: result.rows,
    });

  } catch (err) {

    console.error(
      "GET ACTIVE ANNOUNCEMENTS ERROR:",
      err
    );

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil pengumuman",
    });

  }
};

// =====================================
// GET ALL ANNOUNCEMENTS
// DASHBOARD HR
// =====================================

exports.getAllAnnouncements = async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT
        id,
        title,
        description,
        image_url,
        button_text,
        button_link,
        is_active,
        sort_order,
        start_date,
        end_date,
        created_at,
        updated_at,
        url 
      FROM announcements
     ORDER BY created_at DESC
    `);

    return res.status(200).json({
      success: true,
      data: result.rows,
    });

  } catch (err) {

    console.error(
      "GET ALL ANNOUNCEMENTS ERROR:",
      err
    );

    return res.status(500).json({
      success: false,
      message: "Gagal mengambil data pengumuman",
    });

  }
};


// =====================================
// CREATE ANNOUNCEMENT
// DASHBOARD HR
// =====================================

exports.createAnnouncement = async (req, res) => {
  try {

    const {
      title,
      description,
      url,
      is_active,
      start_date,
      end_date,
    } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Judul pengumuman wajib diisi",
      });
    }

    let image_url = null;

    if (req.file) {
      image_url =
        `/uploads/announcements/${req.file.filename}`;
    }

    const result = await pool.query(
      `
            INSERT INTO announcements (
                title,
                description,
                image_url,
                url,
                is_active,
                start_date,
                end_date
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
            `,
      [
        title,
        description || null,
        image_url,
        url || null,
        is_active === "false" ? false : true,
        start_date || null,
        end_date || null,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Pengumuman berhasil dibuat",
      data: result.rows[0],
    });

  } catch (err) {

    console.error(
      "CREATE ANNOUNCEMENT ERROR:",
      err
    );

    return res.status(500).json({
      success: false,
      message: "Gagal membuat pengumuman",
    });
  }
};

exports.updateAnnouncementStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const result = await pool.query(
      `
            UPDATE announcements
            SET
                is_active = $1,
                updated_at = NOW()
            WHERE id = $2
            RETURNING *
            `,
      [is_active, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Pengumuman tidak ditemukan"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Status pengumuman berhasil diperbarui",
      data: result.rows[0]
    });

  } catch (err) {
    console.error("UPDATE ANNOUNCEMENT STATUS ERROR:", err);

    return res.status(500).json({
      success: false,
      message: "Gagal memperbarui status pengumuman"
    });
  }
};