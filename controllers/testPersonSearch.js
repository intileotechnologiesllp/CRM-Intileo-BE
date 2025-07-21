// Test endpoint for debugging person search
exports.testPersonSearch = async (req, res) => {
  try {
    const { searchTerm = "john", adminId } = req.query;
    const userAdminId = adminId || req.adminId;

    console.log("=== PERSON SEARCH TEST ===");
    console.log("Search term:", searchTerm);
    console.log("Admin ID:", userAdminId);

    // Test 1: Check database connection
    const Person = require("../models/leads/leadPersonModel");
    const { Op } = require("sequelize");

    // Test 2: Count total people
    const totalPeople = await Person.count({
      where: { masterUserID: userAdminId },
    });

    // Test 3: Get sample people
    const samplePeople = await Person.findAll({
      where: { masterUserID: userAdminId },
      limit: 5,
      attributes: [
        "personId",
        "contactPerson",
        "email",
        "phone",
        "jobTitle",
        "organization",
      ],
    });

    // Test 4: Basic search
    const basicSearch = await Person.findAll({
      where: {
        masterUserID: userAdminId,
        contactPerson: { [Op.like]: `%${searchTerm}%` },
      },
      limit: 10,
    });

    // Test 5: Case-insensitive search (if database supports it)
    let caseInsensitiveSearch = [];
    try {
      caseInsensitiveSearch = await Person.findAll({
        where: {
          masterUserID: userAdminId,
          contactPerson: { [Op.iLike]: `%${searchTerm}%` },
        },
        limit: 10,
      });
    } catch (iLikeError) {
      console.log("iLike not supported, trying LOWER function");
      // Fallback for databases that don't support iLike
      caseInsensitiveSearch = await Person.findAll({
        where: {
          masterUserID: userAdminId,
          [Op.where]: sequelize.fn("LOWER", sequelize.col("contactPerson")),
          [Op.like]: `%${searchTerm.toLowerCase()}%`,
        },
        limit: 10,
      });
    }

    // Test 6: Multiple field search
    const multiFieldSearch = await Person.findAll({
      where: {
        masterUserID: userAdminId,
        [Op.or]: [
          { contactPerson: { [Op.like]: `%${searchTerm}%` } },
          { email: { [Op.like]: `%${searchTerm}%` } },
          { organization: { [Op.like]: `%${searchTerm}%` } },
        ],
      },
      limit: 10,
    });

    res.json({
      testResults: {
        totalPeople,
        samplePeople: samplePeople.map((p) => ({
          personId: p.personId,
          contactPerson: p.contactPerson,
          email: p.email,
          organization: p.organization,
        })),
        basicSearch: basicSearch.length,
        caseInsensitiveSearch: caseInsensitiveSearch.length,
        multiFieldSearch: multiFieldSearch.length,
        basicSearchResults: basicSearch.map((p) => ({
          personId: p.personId,
          contactPerson: p.contactPerson,
          email: p.email,
        })),
        caseInsensitiveSearchResults: caseInsensitiveSearch.map((p) => ({
          personId: p.personId,
          contactPerson: p.contactPerson,
          email: p.email,
        })),
        multiFieldSearchResults: multiFieldSearch.map((p) => ({
          personId: p.personId,
          contactPerson: p.contactPerson,
          email: p.email,
          organization: p.organization,
        })),
      },
      searchConfig: {
        searchTerm,
        adminId: userAdminId,
        databaseDialect: "mysql",
      },
    });
  } catch (error) {
    console.error("Person search test error:", error);
    res.status(500).json({
      error: error.message,
      stack: error.stack,
    });
  }
};
