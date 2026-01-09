// const adminService = require("../../services/adminServices.js");
const axios = require("axios");

exports.getPlans = async (req, res) => {

  try {

    // Call third-party API
    let thirdPartyResponse;
    try {
      thirdPartyResponse = await axios.get(
        `${process.env.FRONTEND_ADMIN_URL}/api/v1/public/clients/get-plans`,
      );
    } catch (thirdPartyError) {
      console.error(
        "Third-party API error:",
        thirdPartyError.response?.data || thirdPartyError.message
      );

      // Return appropriate error message
      let errorMessage = "Failed to get plans in third-party system";
      if (thirdPartyError.response?.status === 429) {
        errorMessage = "Rate limit exceeded. Please try again later.";
      } else if (thirdPartyError.response?.data?.message) {
        errorMessage = thirdPartyError.response.data.message;
      }

      return res.status(thirdPartyError.response?.status || 500).json({
        message: errorMessage,
      });
    }

    // Check if third-party API was successful
    if (!thirdPartyResponse.data.success) {
      return res.status(thirdPartyResponse.status || 400).json({
        message:
          thirdPartyResponse.data.message ||
          "Failed to get plans in third-party system",
      });
    }

    // Extract data from third-party response
    const thirdPartyClient = thirdPartyResponse.data.data;

    // Send response
    res.status(201).json({
      message: `Plans fetched successfully`,
      data: thirdPartyClient
    });
  } catch (error) {
    console.error("Error in fetching plans:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getFeaturesWithPlans = async (req, res) => {

  try {

    // Call third-party API
    let thirdPartyResponse;
    try {
      thirdPartyResponse = await axios.get(
        `${process.env.FRONTEND_ADMIN_URL}/api/v1/public/clients/get-features-withplan`,
      );
    } catch (thirdPartyError) {
      console.error(
        "Third-party API error:",
        thirdPartyError.response?.data || thirdPartyError.message
      );

      // Return appropriate error message
      let errorMessage = "Failed to get features with plans in third-party system";
      if (thirdPartyError.response?.status === 429) {
        errorMessage = "Rate limit exceeded. Please try again later.";
      } else if (thirdPartyError.response?.data?.message) {
        errorMessage = thirdPartyError.response.data.message;
      }

      return res.status(thirdPartyError.response?.status || 500).json({
        message: errorMessage,
      });
    }

    // Check if third-party API was successful
    if (!thirdPartyResponse.data.success) {
      return res.status(thirdPartyResponse.status || 400).json({
        message:
          thirdPartyResponse.data.message ||
          "Failed to get features with plans in third-party system",
      });
    }

    // Extract data from third-party response
    const thirdPartyClient = thirdPartyResponse.data.data;

    // Send response
    res.status(201).json({
      message: `Features with Plans fetched successfully`,
      data: thirdPartyClient
    });
  } catch (error) {
    console.error("Error in fetching features with plans:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
