const { Automation } = require("../../models");

exports.createAutomation = async (req, res) => {
  const {Automation} = req.models;
  const { automationJson } = req.body; // e.g., { orderedIds: [3, 1, 2, 4], entityType: "deal" }
  try {
    if (!automationJson) {
      return res.status(400).json({ error: "automationJson is required" });
    }
    // Process the automationJson as needed
    // For example, save it to the database or perform some actions
    // Here, we'll just log it and return a success response
    await Automation.create({
      automationData: automationJson,
      createdBy: req.adminId,
      isActive: true,
    });
    console.log("Received automation JSON:", automationJson);
    return res.status(200).json({ message: "Automation created successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update order" });
  }
};

exports.editAutomation = async (req, res) => {
  const {Automation} = req.models;
  const { automationJson } = req.body; // e.g., { orderedIds: [3, 1, 2, 4], entityType: "deal" }
  try {
    if (!automationJson) {
      return res.status(400).json({ error: "automationJson is required" });
    }
    // Process the automationJson as needed
    // For example, save it to the database or perform some actions
    // Here, we'll just log it and return a success response
    await Automation.update(
      {
        where: {
          createdBy: req.adminId,
        },
      },
      {
        automationData: automationJson,
        createdBy: req.adminId,
        isActive: true,
      }
    );
    console.log("Received automation JSON:", automationJson);
    return res.status(200).json({ message: "Automation created successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update order" });
  }
};

exports.getAutomations = async (req, res) => {
  const {Automation} = req.models;
  try {
    const { status } = req.query;

    const filter = {
      createdBy: req.adminId,
    };

    if (status) {
      filter["isActive"] = status === "active" ? true : false;
    }
    const automations = await Automation.findAll({
      where: filter,
    });

    return res.status(200).json({ automations });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch automations" });
  }
};

exports.deleteAutomations = async (req, res) => {
  const {Automation} = req.models;
  try {
    const { id } = req.params;
    const automations = await Automation.destroy({
      where: {
        createdBy: req.adminId,
        id: id,
      },
    });

    return res.status(200).json({ message: "Automation deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch automations" });
  }
};
