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
  try {
    const findSet = await permissionSet.findAll({
      include: [{ model: MasterUser, as: "pusers" }],
    });

    // For each permission set, also fetch users where globalPermissionSetId matches
    const enrichedSets = await Promise.all(
      findSet.map(async (set) => {
        const setData = set.toJSON();

        // Fetch users where globalPermissionSetId matches this permission set
        const globalUsers = await MasterUser.findAll({
          where: { globalPermissionSetId: setData.permissionSetId },
          raw: true,
        });

        // Combine both regular users and global users
        // Remove duplicates (users who might have both FKs set)
        const userMap = new Map();
        
        // Add regular users from the include
        if (setData.pusers) {
          setData.pusers.forEach((user) => {
            userMap.set(user.masterUserID, user);
          });
        }

        // Add global users
        globalUsers.forEach((user) => {
          if (!userMap.has(user.masterUserID)) {
            userMap.set(user.masterUserID, user);
          }
        });

        // Replace pusers with combined list
        setData.pusers = Array.from(userMap.values());

        return setData;
      })
    );

    res.status(200).json({
      message: "permission set fetched successfully.",
      set: enrichedSets,
    });
  } catch (error) {
    console.error("Error fetching permission sets:", error);
    res.status(500).json({
      message: "Error fetching permission sets",
      success: false,
      error: error.message,
    });
  }
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

// config = {
//     0: true,//AddDeals: true,
//     1: true, // Edit deals owned by other users
//     2: true, // Edit the owner on a deal owned by other users
//     3: true, // Delete deals
//     4: true, // Convert deals to leads
//     5: true, // Merge deals
//     6: true, // Edit a deal's won/lost time
//     7: true, // Add lead
//     8: true, // Edit leads owned by other users
//     9: true, // Edit the owner on a lead owned by other users
//     10: true, // Delete leads
//     11: true, // Merge leads
//     12: true, // See the number of deals and value sum in pipelines and deal list views
// }
