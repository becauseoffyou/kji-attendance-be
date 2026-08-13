const mailer = require("../config/mail");

const { google } = require("googleapis");

const oauth2Client = require("../config/google");
const { sendEmail } = require("../services/googleMailService");

exports.testEmail = async (req, res) => {
  try {
    const email = req.query.email;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email tujuan wajib diisi.",
      });
    }

    console.log("📧 Gmail API →", email);

    const result = await sendEmail({
      to: email,

      subject: "Test Email - KJI Attendance",

      html: `
                <div style="
                    font-family: Arial, sans-serif;
                    padding: 20px;
                ">

                    <h2>
                        KJI Attendance
                    </h2>

                    <p>
                        Halo 👋
                    </p>

                    <p>
                        Ini adalah email percobaan
                        dari sistem KJI Attendance.
                    </p>

                    <p>
                        Gmail API berhasil terhubung
                        dengan backend Railway.
                    </p>

                </div>
            `,
    });

    console.log("✅ Gmail API berhasil:", result.id);

    return res.json({
      success: true,
      message: "Email berhasil dikirim.",
      messageId: result.id,
    });
  } catch (err) {
    console.error(
      "❌ GMAIL API ERROR:",
      err.response?.data || err.message || err,
    );

    return res.status(500).json({
      success: false,
      message: err.response?.data?.error?.message || err.message,
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
