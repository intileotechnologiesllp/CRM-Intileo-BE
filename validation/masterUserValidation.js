const Joi = require("joi");

const masterUserSchema = Joi.object({
  name: Joi.string().min(3).max(50).required().messages({
    "string.base": "Name must be a string.",
    "string.empty": "Name is required.",
    "string.min": "Name must be at least 3 characters long.",
    "string.max": "Name must not exceed 50 characters.",
    "any.required": "Name is required.",
  }),
  email: Joi.string().email().required().messages({
    "string.base": "Email must be a string.",
    "string.empty": "Email is required.",
    "string.email": "Email must be a valid email address.",
    "any.required": "Email is required.",
  }),
  designation: Joi.string()
    .when("key", {
      is: "general",
      then: Joi.required(),
      otherwise: Joi.optional(),
    })
    .messages({
      "string.base": "Designation must be a string.",
      "string.empty": "Designation is required for general users.",
      "any.required": "Designation is required for general users.",
    }),
  department: Joi.string()
    .when("key", {
      is: "general",
      then: Joi.required(),
      otherwise: Joi.optional(),
    })
    .messages({
      "string.base": "Department must be a string.",
      "string.empty": "Department is required for general users.",
      "any.required": "Department is required for general users.",
    }),
  // loginType: Joi.string().valid("master").required().messages({
  //   "string.base": "Login type must be a string.",
  //   "string.empty": "Login type is required.",
  //   "any.required": "Login type is required.",
  // }),
  key: Joi.string().valid("admin", "general").required().messages({
    "string.base": "Key must be a string.",
    "string.empty": "Key is required.",
    "any.required": "Key is required.",
  }),
  password: Joi.string()
    .when("key", {
      is: "admin",
      then: Joi.required(),
      otherwise: Joi.optional(),
    })
    .messages({
      "string.base": "Password must be a string.",
      "string.empty": "Password is required for admin users.",
      "any.required": "Password is required for admin users.",
    }),
});

module.exports = masterUserSchema;
