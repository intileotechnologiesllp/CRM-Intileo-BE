const MasterUser = require("../models/master/masterUserModel");
const permissionSet = require("../models/permissionsetModel");

exports.createPermissionSet = async (req, res) => {
  const { name, description, permission, groupName } = req.body; // [{ personId, customFields }]

  const findSet = await permissionSet.findOne({
    where: {
      name: name?.toLowerCase(),
    },
  });

  if (findSet) {
    res.status(400).json({
      message: "permission Set Already Exist",
    });
  }

  await permissionSet.create({
    name: name,
    description: description,
    permissions: permission,
    groupName: groupName,
  });
  res.status(200).json({
    message: "permission set create successfully.",
  });
};
exports.getPermissionSet = async (req, res) => {
  const findSet = await permissionSet.findAll({
     include: [{ model: MasterUser, as: "pusers" }],
  });

  if (!findSet) {
    res.status(400).json({
      message: "Permission set Not Fount",
      set: [],
    });
  }

  res.status(200).json({
    message: "permission set create successfully.",
    set: findSet,
  });
};

exports.updatePermissionSet = async (req, res) => {
  try {
    const { name, permission } = req.body; // [{ personId, customFields }]

    const findSet = await permissionSet.findOne({
      where: {
        name: name?.toLowerCase(),
      },
    });

    console.log(findSet);
    if (!findSet) {
      return res.status(400).json({
        message: "permission Set not found",
      });
    }

    console.log(permission);
    await permissionSet.update(
      {
        permissions: permission,
      },
      {
        where: {
          name: name,
        },
      }
    );
   return res.status(200).json({
      message: "permission set update successfully.",
    });
  } catch (e) {
    console.log(e);
    res.status(400).send("Something went wrong");
  }
};

// Permission Configuration Structure:
// config = {
//     // Deals permissions (programId: 1)
//     0: true,  // Add deals
//     1: true,  // Edit deals owned by other users
//     2: true,  // Edit the owner on a deal owned by other users
//     3: true,  // Delete deals
//     4: true,  // Convert deals to leads
//     5: true,  // Merge deals
//     6: true,  // Edit a deal's won/lost time
//     
//     // Leads permissions (programId: 2)
//     7: true,  // Add lead
//     8: true,  // Edit leads owned by other users
//     9: true,  // Edit the owner on a lead owned by other users
//     10: true, // Delete leads
//     11: true, // Merge leads
//     
//     // Analytics/Views permissions (programId: 3)
//     12: true, // See the number of deals and value sum in pipelines and deal list views
//     
//     // Activities permissions (programId: 4)
//     21: true, // Edit the owner on an activity owned by other users
//     22: true, // Delete activities
//     
//     // People/Organization permissions (programId: 5)
//     23: true, // Add people
//     25: true, // Delete people
//     26: true, // Add organizations
//     28: true, // Delete organizations
//     
//     // Filter permissions (programId: 6)
//     18: true, // Share filters with other users
//     19: true, // Edit shared filters of other users
//     
//     // Products permissions (programId: 7)
//     29: true, // Add products
//     30: true, // Edit products owned by other users
//     31: true, // Edit the owner on a product owned by other users
//     32: true, // Delete products
//     33: true, // Delete product price variations
// }
