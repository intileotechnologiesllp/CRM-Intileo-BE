
const ReportFolder = require("../../models/insight/reportFolderModel")


exports.createReportFolder = async (req, res) => {
  const {ReportFolder} = req.models;
  try {
    const {
      name
    } = req.body;
    const ownerId = req.adminId;

    // Verify Report Folder ownership if name is provided
      const reportFolder = await ReportFolder.findOne({
        where: {
          name,
          ownerId,
        },
      });

      if (reportFolder) {
        return res.status(404).json({
          success: false,
          message: "Report Folder already exists",
        });
      }

    
    const newReportFolder = await ReportFolder.create({
      name: name,
      ownerId,
    });

    res.status(201).json({
      success: true,
      message: "Report Folder created successfully",
      data: {
        ...newReportFolder.toJSON(),
      },
    });
  } catch (error) {
    console.error("Error creating report folder:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create report folder",
      error: error.message,
    });
  }
};


exports.getReportFolders = async (req, res) => {
  const {ReportFolder} = req.models;
  try {
    const ownerId = req.adminId;

    // Verify Report Folder ownership if name is provided
      const reportFolder = await ReportFolder.findAll({
        where: {
          ownerId,
        },
      });

      if (!reportFolder) {
        return res.status(404).json({
          success: false,
          message: "Report Folder not found or access denied",
        });
      }

    res.status(201).json({
      success: true,
      message: "Report Folders fetched successfully",
      data: reportFolder,
    });
  } catch (error) {
    console.error("Error getting report folders:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get report folders",
      error: error.message,
    });
  }
};


exports.deleteReportFolder = async (req, res) => {
  const {ReportFolder} = req.models;
  try {
    const { reportFolderId } = req.params;
    const ownerId = req.adminId;

    // Validate that reportId is provided
    if (!reportFolderId) {
      return res.status(400).json({
        success: false,
        message: "Report ID is required",
      });
    }

    // Find the report and verify ownership
    const report = await ReportFolder.findOne({
      where: {
        reportFolderId,
        ownerId, // Ensure user can only delete their own reports
      },
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report folder not found or access denied",
      });
    }

    // Delete the report
    const deletedCount = await ReportFolder.destroy({
      where: {
        reportFolderId,
        ownerId, // Ensure only the owner can delete
      },
    });

    if (deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Report folder not found or already deleted",
      });
    }

    res.status(200).json({
      success: true,
      message: "Report folder deleted successfully",
      data: {
        reportFolderId: parseInt(reportFolderId),
        deleted: true
      }
    });

  } catch (error) {
    console.error("Error deleting report folder:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete report folder",
      error: error.message,
    });
  }
};


exports.updateReportFolder = async (req, res) => {
  const {ReportFolder} = req.models;
  try {
    const { reportFolderId } = req.params;
    const {name} = req.body
    const ownerId = req.adminId;

    // Validate that reportId is provided
    if (!reportFolderId) {
      return res.status(400).json({
        success: false,
        message: "Report ID is required",
      });
    }

    // Find the report and verify ownership
    const report = await ReportFolder.findOne({
      where: {
        reportFolderId,
        ownerId, // Ensure user can only delete their own reports
      },
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report folder not found or access denied",
      });
    }

    // Delete the report
    const updatedCount = await ReportFolder.update(
    {
      name : name
    },
    {
      where: {
        reportFolderId,
        ownerId, 
      },
    });

    if (updatedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Report folder not found or no changes made",
      });
    }

    const updatedReport = await ReportFolder.findOne({
      where: { reportFolderId },
    });

    res.status(200).json({
      success: true,
      message: "Report folder updated successfully",
      data: updatedReport
    });

  } catch (error) {
    console.error("Error deleting report folder:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete report folder",
      error: error.message,
    });
  }
};