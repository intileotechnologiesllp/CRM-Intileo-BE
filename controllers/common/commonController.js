const { StartupQuestion } = require("../../models");

exports.saveStartUpQuestions = async (req, res) => {
  const {
    jobTitle,
    useCrmBefore,
    companySize,
    industry,
    companyName,
    totalEmployees,
    focus,
  } = req.body;

  // if (
  //   !jobTitle ||
  //   !useCrmBefore ||
  //   !companySize ||
  //   !industry ||
  //   !companyName ||
  //   !totalEmployees ||
  //   !focus
  // ) {
  //   return res.status(400).json({ error: "All fields are required." });
  // }
  const userId = req.adminId;

  await StartupQuestion.create({
    masterUserID: userId,
    jobTitle,
    useCrmBefore,
    companySize,
    industry,
    companyName,
    totalEmployees,
    focus,
  });

  res.status(201).json({ message: "Startup questions saved successfully." });
};

exports.getStartUpQuestions = async (req, res) =>{
    const userId = req.adminId;

    const questions = await StartupQuestion.findAll({
        where: {
            masterUserID: userId,
        },
    });

    res.status(200).json({ questions });
}
