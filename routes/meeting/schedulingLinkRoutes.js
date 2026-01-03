const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");
const schedulingLinkController = require("../../controllers/meeting/schedulingLinkController");


router.get("/getDateTimeSlote",  schedulingLinkController.getTimeSlots);

/**
 * @route   POST /api/meetings/scheduling-links
 * @desc    Create a new scheduling link
 * @access  Private
 */
router.post("/", verifyToken, schedulingLinkController.createOrUpdateLink);

/**
 * @route   GET /api/meetings/scheduling-links
 * @desc    Get all scheduling links for authenticated user
 * @access  Private
 */
router.get("/", schedulingLinkController.getUserLinks);

/**
 * @route   GET /api/meetings/scheduling-links/:id
 * @desc    Get a scheduling link by ID
 * @access  Private
 */
router.get("/:id", schedulingLinkController.getLinkById);

/**
 * @route   PUT /api/meetings/scheduling-links/:id
 * @desc    Update a scheduling link
 * @access  Private
 */
router.put("/:id", verifyToken, schedulingLinkController.createOrUpdateLink);

/**
 * @route   DELETE /api/meetings/scheduling-links/:id
 * @desc    Delete a scheduling link
 * @access  Private
 */
router.delete("/:id", verifyToken, schedulingLinkController.deleteLink);

router.post("/book-meeting", schedulingLinkController.bookGoogleMeet);


/**
 * PUBLIC ROUTES (No authentication required)
 */


module.exports = router;

