const mailer = require("../config/mail");

const { google } = require("googleapis");

const oauth2Client = require("../config/google");
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

exports.googleAuth = async (req, res) => {
  try {
    const scopes = ["https://www.googleapis.com/auth/gmail.send"];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: scopes,
    });

    return res.redirect(authUrl);
  } catch (err) {
    console.error("GOOGLE AUTH ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.googleCallback = async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Authorization code tidak ditemukan.",
      });
    }

    const { tokens } = await oauth2Client.getToken(code);

    console.log("==============================");

    console.log("GOOGLE REFRESH TOKEN:");

    console.log(tokens.refresh_token);

    console.log("==============================");

    return res.json({
      success: true,
      message: "Authorization berhasil. Cek Railway Logs untuk refresh token.",
    });
  } catch (err) {
    console.error("GOOGLE CALLBACK ERROR:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
