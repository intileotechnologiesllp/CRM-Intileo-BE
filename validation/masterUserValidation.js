const Joi = require("joi");

const masterUserSchema = Joi.object({
  name: Joi.string().min(3).max(100).required().messages({
    "string.empty": "Name cannot be empty",
    "string.min": "Name must be at least 3 characters",
    "string.max": "Name cannot exceed 100 characters",
    "any.required": "Name is required",
  }),
  email: Joi.string().email().required().messages({
    "string.empty": "Email cannot be empty",
    "string.email": "Invalid email format",
    "any.required": "Email is required",
  }),
  designation: Joi.string().min(3).max(100).required().messages({
    "string.empty": "Designation cannot be empty",
    "string.min": "Designation must be at least 3 characters",
    "string.max": "Designation cannot exceed 100 characters",
    "any.required": "Designation is required",
  }),
  department: Joi.string().min(3).max(100).required().messages({
    "string.empty": "Department cannot be empty",
    "string.min": "Department must be at least 3 characters",
    "string.max": "Department cannot exceed 100 characters",
    "any.required": "Department is required",
  }),
  isActive: Joi.boolean().optional(),
});

module.exports = masterUserSchema;
