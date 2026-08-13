const { google } = require("googleapis");

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const gmail = google.gmail({
  version: "v1",
  auth: oauth2Client,
});

const createRawMessage = ({ from, to, subject, html }) => {
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    html,
  ].join("\r\n");

  return Buffer.from(message).toString("base64url");
};

const sendEmail = async ({ to, subject, html }) => {
  const raw = createRawMessage({
    from: process.env.GOOGLE_EMAIL,
    to,
    subject,
    html,
  });

  const result = await gmail.users.messages.send({
    userId: "me",

    requestBody: {
      raw,
    },
  });

  return result.data;
};

module.exports = {
  sendEmail,
};
