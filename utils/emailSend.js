const nodemailer = require("nodemailer");
const UserCredential = require("../models/email/userCredentialModel"); // Adjust path as needed

async function sendEmail(adminEmail, { from, to, subject, text }) {
    console.log(`Sending email from: ${from}, to: ${to}, subject: ${subject}`);
    console.log(adminEmail," adminEmail");
    
  // Fetch user credentials from DB
  const userCredential = await UserCredential.findOne({ where: { email: adminEmail } });
  if (!userCredential) {
    throw new Error(`UserCredential not found for: ${adminEmail}`);
  }

  // Prepare SMTP config from userCredential
  const transporter = nodemailer.createTransport({
    host: userCredential.smtpHost,
    port: userCredential.smtpPort,
    secure: !!userCredential.smtpSecure, // true if smtpSecure is truthy
    auth: {
      user: userCredential.email,
      pass: userCredential.appPassword,
    },
  });

  const mailOptions = {
    from,
    to,
    subject,
    text,
  };

  return transporter.sendMail(mailOptions);
}

module.exports = { sendEmail };