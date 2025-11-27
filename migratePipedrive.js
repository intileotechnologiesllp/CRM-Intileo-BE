const sequelize = require('./config/db');

const XLSX = require('xlsx');
// // Manually set your database credentials here
// const sequelize = new Sequelize(
//   'crm',     // database name
//   'root',     // username
//   'mridul@123', // password
//   {
//     host: 'localhost', // or your DB host
//     port: 3306,        // or your DB port
//     dialect: 'mysql',
//     logging: false,
//   }
// );


// Import models after initializing sequelize
const Lead = require('./models/leads/leadsModel');

// const CustomField = require('./models/customFieldModel');
// const CustomFieldValue = require('./models/customFieldValueModel');


// async function ensureCustomField() {
//   const fieldId = 29;
//   const fieldName = 'espl_proposal_no';
//   const fieldLabel = 'ESPL Proposal No';
//   const fieldType = 'text';
//   const fieldSource = 'custom';
//   const entityType = 'lead';
//
//   let customField = await CustomField.findOne({ where: { fieldId } });
//   if (!customField) {
//     customField = await CustomField.create({
//       fieldId,
//       fieldName,
//       fieldLabel,
//       fieldType,
//       fieldSource,
//       entityType,
//       isActive: true,
//       masterUserID: 53,
//     });
//     console.log('Created custom field for ESPL Proposal No');
//   } else {
//     console.log('Custom field for ESPL Proposal No already exists');
//   }
//   return customField;
// }

async function migrateLeads() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');
  // const customField = await ensureCustomField();
    const workbook = XLSX.readFile('leads-18528407-213.xlsx');
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    for (const row of rows) {
      try {
        // Map Excel columns to Lead fields
        const leadData = {
          contactPerson: row['Contact Person'] || row['contactPerson'] || row['contact_person'],
          email: row['Email'] || row['email'],
          organization: row['Organization'] || row['organization'],
          title: row['Title'] || row['title'],
          // Add more mappings as needed
        };
        const lead = await Lead.create(leadData);
  // await CustomFieldValue.create({
  //   fieldId: 29,
  //   entityId: lead.leadId || lead.id,
  //   entityType: 'lead',
  //   value: row['ESPL Proposal No'] || row['espl_proposal_no'],
  //   masterUserID: 31,
  // });
        console.log(`Migrated lead: ${lead.contactPerson} (${lead.email})`);
      } catch (err) {
        console.error('Error migrating lead row:', row, err);
      }
    }
    console.log('Migration complete.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateLeads();
