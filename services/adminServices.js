const Admin = require("../models/adminModel");
const bcrypt = require("bcrypt");

exports.signIn = async (email, password) => {
  const admin = await Admin.findOne({ where: { email } });
  if (!admin) throw new Error("Admin not found");

  const isPasswordValid = await bcrypt.compare(password, admin.password);
  if (!isPasswordValid) throw new Error("Invalid credentials");

  return admin;
};

exports.createAdmin = async (email, password) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  return await Admin.create({ email, password: hashedPassword });
};

exports.findAdminByEmail = async (email) => {
  return await Admin.findOne({ where: { email } });
};

exports.saveOtp = async (adminId, otp) => {
  const expirationTime = new Date(Date.now() + 10 * 60 * 1000); // OTP valid for 10 minutes
  await Admin.update(
    { otp, otpExpiration: expirationTime },
    { where: { id: adminId } }
  );
};