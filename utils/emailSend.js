// REFACTORED: Models now passed as parameters to support dynamic databases
const nodemailer = require("nodemailer");

async function sendEmail(adminEmail, { from, to, subject, text, html }, UserCredential) {
  console.log(`Sending email from: ${from}, to: ${to}, subject: ${subject}`);
  console.log(adminEmail, " adminEmail");

  // Fetch user credentials from DB
  const userCredential = await UserCredential.findOne({
    where: { email: adminEmail },
  });
  if (!userCredential) {
    console.log(
      `⚠️ UserCredential not found for: ${adminEmail} - Email will not be sent`
    );
    return {
      success: false,
      message: `UserCredential not found for: ${adminEmail}`,
    };
  }
  //   console.log("userCredential", userCredential);

  console.log(
    "SMTP config:",
    userCredential.smtpHost,
    userCredential.smtpPort,
    userCredential.smtpSecure
  );
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
  };

  if (html) {
    mailOptions = {
      from,
      to,
      subject,
      html,
    };
  } else {
    mailOptions = {
      from,
      to,
      subject,
      text,
    };
  }

  return transporter.sendMail(mailOptions);
}

module.exports = { sendEmail };
