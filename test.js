exports.getRelatedEmails = async (req, res) => {
  const { emailId } = req.params;

  try {
    // Fetch the main email by emailId
    const mainEmail = await Email.findOne({
      where: { emailID: emailId },
    });

    if (!mainEmail) {
      return res.status(404).json({ message: "Email not found." });
    }

    console.log(`Fetching related emails for thread: ${mainEmail.messageId}`);

    // Fetch related emails in the same thread
    const relatedEmails = await Email.findAll({
      where: {
        [Sequelize.Op.or]: [
          { messageId: mainEmail.inReplyTo }, // Parent email
          { inReplyTo: mainEmail.messageId }, // Replies to this email
          { references: { [Sequelize.Op.like]: `%${mainEmail.messageId}%` } }, // Emails in the same thread
        ],
      },
      order: [["createdAt", "ASC"]], // Sort by date
    });

    res.status(200).json({
      message: "Related emails fetched successfully.",
      mainEmail,
      relatedEmails,
    });
  } catch (error) {
    console.error("Error fetching related emails:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};