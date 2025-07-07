// SUGGESTED APPROACH: Minimal Lead Model + Custom Fields

const Lead = sequelize.define(
  "Lead",
  {
    // === CORE FIELDS (Keep hardcoded) ===
    leadId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    // Essential identifying fields
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    contactPerson: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    // Relationships
    personId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    leadOrganizationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    // System fields
    masterUserID: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ownerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    isArchived: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    dealId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    // === MOVE TO CUSTOM FIELDS ===
    // valueLabels -> Custom field with fieldSource: "default"
    // expectedCloseDate -> Custom field with fieldSource: "default"
    // sourceChannel -> Custom field with fieldSource: "default"
    // phone -> Custom field with fieldSource: "default"
    // email -> Custom field with fieldSource: "default"
    // proposalValue -> Custom field with fieldSource: "default"
    // etc.
  },
  {
    tableName: "Leads",
    timestamps: true,
  }
);
