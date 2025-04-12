const Joi = require("joi");

const designationSchema = Joi.object({
  designation_desc: Joi.string().min(3).max(100).required(),
});

module.exports = { designationSchema };
