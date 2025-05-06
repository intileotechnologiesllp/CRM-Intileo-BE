exports.getEmails = async (req, res) => {
  const { page = 1, pageSize = 20, folder, search, isRead } = req.query;
  const masterUserID = req.adminId; // Assuming `adminId` is set in middleware

  try {
    // Build the query filters dynamically
    const filters = {
      masterUserID, // Filter emails by the specific user
    };

    // Filter by folder (e.g., inbox, drafts, archive)
    if (folder) {
      filters.folder = folder;
    }

    // Filter by read/unread status
    if (isRead !== undefined) {
      filters.isRead = isRead === "true"; // Convert string to boolean
    }

    // Search by subject, sender, or recipient
    if (search) {
      filters[Sequelize.Op.or] = [
        { subject: { [Sequelize.Op.like]: `%${search}%` } },
        { sender: { [Sequelize.Op.like]: `%${search}%` } },
        { recipient: { [Sequelize.Op.like]: `%${search}%` } },
      ];
    }

    // Pagination logic
    const offset = (page - 1) * pageSize;
    const limit = parseInt(pageSize);

    // Fetch emails from the database
    const { count, rows: emails } = await Email.findAndCountAll({
      where: filters,
      include: [
        {
          model: Attachment,
          as: "attachments", // Alias defined in the relationship
        },
      ],
      offset,
      limit,
      order: [["createdAt", "DESC"]], // Sort by most recent emails
    });

    // Add baseURL to attachment paths
    const baseURL = process.env.LOCALHOST_URL;
    const emailsWithAttachments = emails.map((email) => {
      const attachments = email.attachments.map((attachment) => ({
        ...attachment.toJSON(),
        path: `${baseURL}/uploads/attachments/${attachment.filename}`, // Add baseURL to the path
      }));
      return {
        ...email.toJSON(),
        attachments,
      };
    });

    // Calculate unviewCount for the specified folder or all folders
    const unviewCount = await Email.count({
      where: {
        ...filters,
        isRead: false, // Count only unread emails
      },
    });

    // Group emails by conversation (thread)
    const threads = {};
    emails.forEach((email) => {
      const threadId = email.inReplyTo || email.messageId; // Use inReplyTo or messageId as thread identifier
      if (!threads[threadId]) {
        threads[threadId] = [];
      }
      threads[threadId].push(email);
    });

    // Return the paginated response with threads and unviewCount
    res.status(200).json({
      message: "Emails fetched successfully.",
      currentPage: parseInt(page),
      totalPages: Math.ceil(count / pageSize),
      totalEmails: count,
      unviewCount, // Include the unviewCount field
      threads: Object.values(threads), // Return grouped threads
    });
  } catch (error) {
    console.error("Error fetching emails:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};