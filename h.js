// testSendNoReply.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com", // Your SMTP server
  port: 587,
  secure: false,
  auth: {
    user: "mridulverma2533@gmail.com",
    pass: "rbtb kmmo hjdk hbub",
  },
});

const mailOptions = {
  from: '"No Reply" <no-reply@yourdomain.com>',
  to: "yaduvanshikiller77@gmail.com",
  subject: "Test Sponsored Email",
  text: "This is a test email from a no-reply address.",
};

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    return console.log(error);
  }
  console.log("Message sent: %s", info.messageId);
});