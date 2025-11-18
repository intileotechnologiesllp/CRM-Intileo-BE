

const Organization = require("../../models/leads/leadOrganizationModel");
exports.getAllLeadContactPersons = async (req, res) => {
  try {
    const { page = 1, limit = 100, search = "" } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build search condition for contactPerson
    const where = search ? { contactPerson: { [Op.like]: `${search}%` } } : {};

    const { rows, count } = await Person.findAndCountAll({
      where,
      attributes: ["personId", "contactPerson", "email", "phone", "leadOrganizationId"],
      include: [
        {
          model: Organization,
          as: "LeadOrganization",
          required: false,
          attributes: ["leadOrganizationId", "organization"]
        }
      ],
      limit: parseInt(limit),
      offset,
      distinct: true,
    });

    // Extract personId, contactPerson, email, phone, and organization values
    const contactPersons = rows
      .filter((person) => person.contactPerson)
      .map((person) => ({
        personId: person.personId,
        contactPerson: person.contactPerson,
        email: person.email,
        phone: person.phone,
        leadOrganizationId: person.leadOrganizationId,
        organization: person.LeadOrganization ? person.LeadOrganization.organization : null
      }));

    res.status(200).json({
      contactPersons,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit),
    });
  } catch (error) {
    console.error("Error fetching contact persons:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};