const pool = require("../config/db");

// exports.leaveRequests = async (req, res) => {
//   try {
//     const supervisorId = req.user.id;

//     const status = req.query.status || "PENDING_SUPERVISOR";

//     let sql = `
//       SELECT

//           lr.id,
//           lr.leave_type,
//           lr.start_date,
//           lr.end_date,
//           lr.reason,
//           lr.attachment,
//           lr.status,
//           lr.created_at,
//           lr.approved_at,

//           u.id AS employee_id,
//           u.name,
//           u.email

//       FROM leave_requests lr

//       JOIN users u
//       ON u.id = lr.user_id

//       WHERE
//           u.supervisor_id = $1
//     `;

//     const params = [supervisorId];
//     if (status !== "ALL") {
//       sql += ` AND lr.status = $2`;

//       params.push(status);
//     }

//     sql += `
//       ORDER BY lr.created_at DESC
//     `;

//     const result = await pool.query(sql, params);

//     const summary = await pool.query(
//       `
//       SELECT

//           COUNT(*) FILTER (
//               WHERE lr.status='PENDING_SUPERVISOR'
//           ) AS pending,

//           COUNT(*) FILTER (
//               WHERE lr.status='APPROVED'
//           ) AS approved,

//           COUNT(*) FILTER (
//               WHERE lr.status='REJECTED'
//           ) AS rejected,

//           COUNT(*) AS total

//       FROM leave_requests lr

//       JOIN users u
//       ON u.id = lr.user_id

//       WHERE
//       u.supervisor_id = $1
//       `,
//       [supervisorId],
//     );

//     return res.json({
//       success: true,

//       summary: summary.rows[0],

//       data: result.rows,
//     });
//   } catch (err) {
//     console.error(err);

//     return res.status(500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// };

exports.leaveRequests = async (req, res) => {
  try {
    const supervisorId = req.user.id;

    const status = req.query.status || "PENDING_SUPERVISOR";

    let sql = `
            SELECT
                lr.id,
                lr.leave_type,
                lr.start_date,
                lr.end_date,
                lr.reason,
                lr.attachment,
                lr.status,
                lr.created_at,
                lr.approved_at,

                u.id AS employee_id,
                u.name,
                u.email,

                'LEAVE' AS request_type,

                NULL::timestamp AS old_check_in,
                NULL::timestamp AS new_check_in,
                NULL::timestamp AS old_check_out,
                NULL::timestamp AS new_check_out

            FROM leave_requests lr

            JOIN users u
                ON u.id = lr.user_id

            WHERE
                u.supervisor_id = $1
        `;

    const params = [supervisorId];

    if (status !== "ALL") {
      sql += ` AND lr.status = $2`;
      params.push(status);
    }

    sql += `

            UNION ALL

            SELECT
                aer.id,

                'PERUBAHAN ABSENSI' AS leave_type,

                a.attendance_date AS start_date,
                a.attendance_date AS end_date,

                aer.reason,

                NULL AS attachment,

                aer.status,
                aer.created_at,
                aer.approved_at,

                u.id AS employee_id,
                u.name,
                u.email,

                'ATTENDANCE_EDIT' AS request_type,

                aer.old_check_in,
                aer.new_check_in,
                aer.old_check_out,
                aer.new_check_out

            FROM attendance_edit_requests aer

            JOIN users u
                ON u.id = aer.user_id

            JOIN attendance a
                ON a.id = aer.attendance_id

            WHERE
                u.supervisor_id = $1
        `;

    if (status !== "ALL") {
      sql += ` AND aer.status = $2`;
    }

    sql += `
            ORDER BY created_at DESC
        `;

    const result = await pool.query(sql, params);

    // ============================
    // SUMMARY
    // ============================

    const summary = await pool.query(
      `
            SELECT
                COUNT(*) FILTER (
                    WHERE status = 'PENDING_SUPERVISOR'
                ) AS pending,

                COUNT(*) FILTER (
                    WHERE status = 'APPROVED'
                ) AS approved,

                COUNT(*) FILTER (
                    WHERE status = 'REJECTED'
                ) AS rejected,

                COUNT(*) AS total

            FROM (

                SELECT
                    lr.status

                FROM leave_requests lr

                JOIN users u
                    ON u.id = lr.user_id

                WHERE
                    u.supervisor_id = $1


                UNION ALL


                SELECT
                    aer.status

                FROM attendance_edit_requests aer

                JOIN users u
                    ON u.id = aer.user_id

                WHERE
                    u.supervisor_id = $1

            ) requests
            `,
      [supervisorId],
    );

    return res.json({
      success: true,
      summary: summary.rows[0],
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
exports.leaveDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const supervisorId = req.user.id;

    const result = await pool.query(
      `
      SELECT

          lr.*,

          u.id AS employee_id,
          u.name,
          u.email,
          u.department,
          u.position,
          u.photo,
          u.leave_balance

      FROM leave_requests lr

      JOIN users u
      ON u.id = lr.user_id

      WHERE

          lr.id = $1

      AND

          u.supervisor_id = $2
      `,
      [id, supervisorId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Data tidak ditemukan.",
      });
    }

    const data = result.rows[0];

    const leaveDays =
      Math.ceil(
        (new Date(data.end_date) - new Date(data.start_date)) /
          (1000 * 60 * 60 * 24),
      ) + 1;

    const isAnnualLeave = data.leave_type === "CUTI";

    data.leave_days = leaveDays;

    data.remaining_leave = isAnnualLeave
      ? Math.max(0, data.leave_balance - leaveDays)
      : data.leave_balance;

    data.can_approve = isAnnualLeave ? data.leave_balance >= leaveDays : true;
    return res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.approveLeave = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id } = req.params;
    const { note } = req.body;

    const supervisorId = req.user.id;

    const result = await client.query(
      `
            SELECT

                lr.*,

                u.leave_balance,
                u.supervisor_id

            FROM leave_requests lr

            JOIN users u
            ON u.id = lr.user_id

            WHERE lr.id = $1

            FOR UPDATE
            `,
      [id],
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Pengajuan tidak ditemukan.",
      });
    }

    const leave = result.rows[0];

    if (leave.supervisor_id !== supervisorId) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses.",
      });
    }

    if (leave.status !== "PENDING_SUPERVISOR") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Pengajuan sudah diproses.",
      });
    }

    const leaveDays =
      Math.ceil(
        (new Date(leave.end_date) - new Date(leave.start_date)) /
          (1000 * 60 * 60 * 24),
      ) + 1;

    const isAnnualLeave = leave.leave_type === "CUTI";

    if (isAnnualLeave && leave.leave_balance < leaveDays) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Sisa cuti tidak mencukupi.",
      });
    }

    // Kurangi saldo cuti
    if (isAnnualLeave) {
      await client.query(
        `
      UPDATE users
      SET leave_balance = leave_balance - $1
      WHERE id = $2
    `,
        [leaveDays, leave.user_id],
      );
    }

    // Approve
    await client.query(
      `
            UPDATE leave_requests
            SET

                status = 'APPROVED',
                approval_note = $1,
                approved_by = $2,
                approved_at = NOW()

            WHERE id = $3
            `,
      [note, supervisorId, id],
    );

    await client.query(
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
        leave.user_id,
        "Pengajuan Disetujui",
        `Pengajuan ${leave.leave_type} Anda telah disetujui.`,
        "LEAVE_APPROVED",
        leave.id,
      ],
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Pengajuan berhasil disetujui.",
    });
  } catch (err) {
    await client.query("ROLLBACK");

    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  } finally {
    client.release();
  }
};

exports.rejectLeave = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id } = req.params;
    const { note } = req.body;

    const supervisorId = req.user.id;

    const result = await client.query(
      `
            SELECT

                lr.*,
                u.supervisor_id

            FROM leave_requests lr

            JOIN users u
            ON u.id = lr.user_id

            WHERE lr.id = $1

            FOR UPDATE
            `,
      [id],
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Pengajuan tidak ditemukan.",
      });
    }

    const leave = result.rows[0];

    if (leave.supervisor_id !== supervisorId) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        success: false,
        message: "Anda tidak memiliki akses.",
      });
    }

    if (leave.status !== "PENDING_SUPERVISOR") {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Pengajuan sudah diproses.",
      });
    }

    await client.query(
      `
            UPDATE leave_requests
            SET

                status = 'REJECTED',
                approval_note = $1,
                approved_by = $2,
                approved_at = NOW()

            WHERE id = $3
            `,
      [note, supervisorId, id],
    );

    await client.query(
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
        leave.user_id,
        "Pengajuan Ditolak",
        `Pengajuan ${leave.leave_type} Anda ditolak.`,
        "LEAVE_REJECTED",
        leave.id,
      ],
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Pengajuan berhasil ditolak.",
    });
  } catch (err) {
    await client.query("ROLLBACK");

    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  } finally {
    client.release();
  }
};
