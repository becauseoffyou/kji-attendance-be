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
      ORDER BY
        sort_order ASC,
        created_at DESC
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
      ORDER BY sort_order ASC, created_at DESC
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
      image_url,
      button_text,
      button_link,
      is_active,
      sort_order,
      start_date,
      end_date,
      url,
    } = req.body;


    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Judul pengumuman wajib diisi",
      });
    }


    if (
      start_date &&
      end_date &&
      new Date(end_date) < new Date(start_date)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Tanggal selesai tidak boleh sebelum tanggal mulai",
      });
    }
    const result = await pool.query(
      `
    INSERT INTO announcements (
      title,
      description,
      image_url,
      url,
      button_text,
      button_link,
      is_active,
      sort_order,
      start_date,
      end_date
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10
    )
    RETURNING *
  `,
      [
        title,
        description || null,
        image_url || null,
        url || null,
        button_text || null,
        button_link || null,
        is_active !== false,
        Number(sort_order) || 0,
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