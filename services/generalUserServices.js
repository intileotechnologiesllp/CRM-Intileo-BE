const GeneralUser = require("../models/generalUserModel");

exports.createGeneralUser = async (data) => {
  return await GeneralUser.create(data);
};

exports.getGeneralUserById = async (generalUserId) => {
  return await GeneralUser.findByPk(generalUserId); // Use generalUserId
};

exports.updateGeneralUser = async (generalUserId, data) => {
  const generalUser = await GeneralUser.findByPk(generalUserId); // Use generalUserId
  if (!generalUser) throw new Error("General user not found");
  return await generalUser.update(data);
};

exports.deleteGeneralUser = async (generalUserId) => {
  const generalUser = await GeneralUser.findByPk(generalUserId); // Use generalUserId
  if (!generalUser) throw new Error("General user not found");
  return await generalUser.destroy();
};
