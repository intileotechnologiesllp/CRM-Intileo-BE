exports.validateIsTrial = async (req, res, next) => {
  try {
    const findPlan = {
      istrial: true,
      trialDays: 15,
      startDate: ""
    }; //await findPlan(req.adminId)

    if (findPlan?.istrial) {
      const trialDays = findPlan.trialDays || 0;

      const startDate = new Date(startDate); // replace with stored trial start date if available
      const expiryDate = new Date(startDate);
      expiryDate.setDate(expiryDate.getDate() + trialDays);

      const currentDate = new Date();

      if (currentDate > expiryDate) {
        return res.status(403).json({
          success: false,
          message: "Trial period has expired",
        });
      }
    }
    next();
  } catch (err) {
    console.error("Error in trial period middleware:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
