const mailer = require("../config/mail");

exports.testEmail = async (req, res) => {
  try {
    const email = req.query.email;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email tujuan wajib diisi.",
      });
    }

    const info = await mailer.sendMail({
      from: process.env.MAIL_FROM,
      to: email,
      subject: "Test Email - KJI Attendance",
      text: "Email berhasil dikirim dari Railway.",
      html: `
                <h2>Test Email</h2>
                <p>Email berhasil dikirim dari Railway.</p>
                <p>Sistem email KJI Attendance berhasil terhubung.</p>
            `,
    });

    return res.json({
      success: true,
      message: "Email berhasil dikirim.",
      messageId: info.messageId,
    });
  } catch (err) {
    console.error("EMAIL ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
