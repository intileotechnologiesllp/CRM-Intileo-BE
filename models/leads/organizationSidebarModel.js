const { DataTypes } = require("sequelize");


const createOrganizationSidebarPreferenceModel = (sequelizeInstance) => {
const OrganizationSidebarPreference = sequelizeInstance.define("OrganizationSidebarPreference", {
  id: { 
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true 
  },
  masterUserID: { 
    type: DataTypes.INTEGER, 
    allowNull: false,
    comment: "User ID who owns these sidebar preferences"
  },
  sidebarSections: { 
    type: DataTypes.JSON, 
    allowNull: false, 
    defaultValue: [
      {
        id: 'summary',
        name: 'Summary',
        enabled: true,
        order: 1,
        draggable: false
      },
      {
        id: 'details',
        name: 'Details',
        enabled: true,
        order: 2,
        draggable: true
      },
      {
        id: 'deals',
        name: 'Deals',
        enabled: true,
        order: 3,
        draggable: true
      },
      {
        id: 'related_organizations',
        name: 'Related organizations',
        enabled: true,
        order: 4,
        draggable: true
      },
      {
        id: 'people',
        name: 'People',
        enabled: true,
        order: 5,
        draggable: true
      },
      {
        id: 'overview',
        name: 'Overview',
        enabled: true,
        order: 6,
        draggable: true
      },
      {
        id: 'smart_bcc',
        name: 'Smart BCC',
        enabled: true,
        order: 7,
        draggable: true
      },
      {
        id: 'leads',
        name: 'Leads',
        enabled: true,
        order: 8,
        draggable: true
      }
    ],
    comment: "JSON array of sidebar sections with their visibility and order preferences"
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'OrganizationSidebarPreferences',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['masterUserID'],
      name: 'unique_organization_sidebar_per_user'
    }
  ]
});
return OrganizationSidebarPreference;
}

module.exports = createOrganizationSidebarPreferenceModel;