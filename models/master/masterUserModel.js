const { DataTypes } = require("sequelize");

/**
 * Factory function to create MasterUser model for a specific database connection
 * @param {Sequelize} sequelizeInstance - Sequelize connection instance
 * @returns {Model} MasterUser model
 */
const createMasterUserModel = (sequelizeInstance) => {
  const MasterUser = sequelizeInstance.define(
    "MasterUser",
    {
      masterUserID: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      designation: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      department: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      creatorId: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      createdBy: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "active",
      },
      resetToken: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      resetTokenExpiry: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      loginType: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      otp: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      otpExpiration: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      userType: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      mobileNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      profileImage: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      bio: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      location: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      lastName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      deactivatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      deactivatedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      deactivationReason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      googleOAuthToken: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      permissionSetId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "PermissionSets", // table name (auto-pluralized)
          key: "permissionSetId",
        },
      },
      globalPermissionSetId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "PermissionSets", // table name (auto-pluralized)
          key: "permissionSetId",
        },
      },
      groupId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "GroupVisibilities", // table name (auto-pluralized)
          key: "groupId",
        },
      },
      // 2FA fields
      twoFactorEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      twoFactorSecret: {
        type: DataTypes.TEXT, // Encrypted TOTP secret
        allowNull: true,
      },
      twoFactorBackupCodes: {
        type: DataTypes.TEXT, // Encrypted backup codes JSON
        allowNull: true,
      },
      twoFactorEnabledAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "MasterUsers",
      timestamps: true,
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    }
  );
  return MasterUser;
};

module.exports = createMasterUserModel;
