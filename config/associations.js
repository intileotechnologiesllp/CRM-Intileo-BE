/**
 * Set up associations between models for a database connection
 * @param {Object} models - Object containing all models for a connection
 */
const setupAssociations = (models) => {
  const { MasterUser, LeadOrganization, LostReason, LeadPerson } = models;
  
  // MasterUser associations
  if (MasterUser && LeadOrganization) {
    MasterUser.hasMany(LeadOrganization, {
      foreignKey: "masterUserID",
      sourceKey: "masterUserID",
      as: "organizations",
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
    
    LeadOrganization.belongsTo(MasterUser, {
      foreignKey: "masterUserID",
      targetKey: "masterUserID",
      as: "owner",
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  }
  

  if (MasterUser && LeadPerson) {
    MasterUser.hasMany(LeadPerson, {
      foreignKey: "masterUserID",
      sourceKey: "masterUserID",
      as: "persons",
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
    
    LeadPerson.belongsTo(MasterUser, {
      foreignKey: "masterUserID",
      targetKey: "masterUserID",
      as: "owner",
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  }

   if (LeadOrganization && LeadPerson) {
    LeadOrganization.hasMany(LeadPerson, {
      foreignKey: "leadOrganizationId",
      sourceKey: "leadOrganizationId",
      as: "persons",
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
    
    LeadPerson.belongsTo(LeadOrganization, {
      foreignKey: "leadOrganizationId",
      targetKey: "leadOrganizationId",
      as: "organizations",
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  }


  // Add other associations here as needed
  // Example: LostReason associations if you have them
  // if (MasterUser && LostReason) {
  //   MasterUser.hasMany(LostReason, {
  //     foreignKey: "masterUserID",
  //     sourceKey: "masterUserID",
  //     as: "lostReasons"
  //   });
  //   
  //   LostReason.belongsTo(MasterUser, {
  //     foreignKey: "masterUserID",
  //     targetKey: "masterUserID",
  //     as: "createdByUser"
  //   });
  // }
  
  console.log("✅ Associations set up successfully");
  
  return models;
};

module.exports = { setupAssociations };