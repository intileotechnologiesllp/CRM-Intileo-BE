const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const GeneralUser = require("../../models/generalUserModel");
const LoginHistory = require("../../models/loginHistoryModel");
const Joi = require("joi");

exports.createGeneralUser = async (req, res) => {
  const { name, email, password, ipAddress, longitude, latitude } = req.body;

  // Validation schema
  const schema = Joi.object({
    name: Joi.string().min(3).max(50).required().messages({
      "string.empty": "Name cannot be empty",
      "string.min": "Name must be at least 3 characters",
      "string.max": "Name cannot exceed 50 characters",
      "any.required": "Name is required",
    }),
    email: Joi.string().email().required().messages({
      "string.empty": "Email cannot be empty",
      "string.email": "Must be a valid email address",
      "any.required": "Email is required",
    }),
    password: Joi.string().min(6).max(100).required().messages({
      "string.empty": "Password cannot be empty",
      "string.min": "Password must be at least 6 characters",
      "string.max": "Password cannot exceed 100 characters",
      "any.required": "Password is required",
    }),
    ipAddress: Joi.string().optional(),
    longitude: Joi.string().optional(),
    latitude: Joi.string().optional(),
  });

  // Validate request body
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  try {
    // Check if the email already exists
    const existingUser = await GeneralUser.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the general user
    const generalUser = await GeneralUser.create({
      name,
      email,
      password: hashedPassword,
      creatorUserId: req.adminId, // Admin ID from the authenticated request
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        generalUserId: generalUser.generalUserId,
        email: generalUser.email,
        role: "general",
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // Log the login history
    await LoginHistory.create({
      userId: generalUser.generalUserId,
      loginType: "general",
      ipAddress: ipAddress || null,
      longitude: longitude || null,
      latitude: latitude || null,
    });

    res.status(201).json({
      message: "General user created successfully",
      generalUser,
      token,
    });
  } catch (error) {
    console.error("Error creating general user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
