const { body, validationResult } = require("express-validator");
const { logAuditTrail } = require("../utils/auditTrailLogger");
const PROGRAMS = require("../utils/programConstants");

exports.validateSignIn = [
  body("email").isEmail().withMessage("Invalid email address"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),

  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Log failed validation attempt in the audit trail
      // const email = req.body.email || "Unknown"; // Use "Unknown" if email is not provided
      await logAuditTrail(
        PROGRAMS.AUTHENTICATION, // Program ID for authentication
        "SIGN_IN", // Mode
        // email, // Email of the user attempting to sign in
        null,
        "Validation failed: " + JSON.stringify(errors.array()) // Error description
      );

      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

exports.validateCreateAdmin = [
  body("email").isEmail().withMessage("Invalid email address"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
];
