const express = require("express");
const router = express.Router();
const { verifyToken } = require("../../middlewares/authMiddleware");
const meetingController = require("../../controllers/meeting/meetingController");

/**
 * @route   POST /api/meetings
 * @desc    Create a new meeting
 * @access  Private
 */
router.post("/", verifyToken, meetingController.createMeeting);

/**
 * @route   GET /api/meetings
 * @desc    Get all meetings for the authenticated user
 * @access  Private
 */
router.get("/", verifyToken, meetingController.getMeetings);

/**
 * @route   POST /api/meetings/check-conflicts
 * @desc    Check for scheduling conflicts
 * @access  Private
 */
router.post("/check-conflicts", verifyToken, meetingController.checkConflicts);

/**
 * @route   GET /api/meetings/available-slots
 * @desc    Get available time slots from Google Calendar
 * @access  Private
 */
router.get("/available-slots", verifyToken, meetingController.getAvailableSlots);

/**
 * @route   GET /api/meetings/calendar-status
 * @desc    Check Google Calendar connection status
 * @access  Private
 */
router.get("/calendar-status", verifyToken, meetingController.getCalendarStatus);

/**
 * @route   GET /api/meetings/:id
 * @desc    Get a single meeting by ID
 * @access  Private
 */
router.get("/:id", verifyToken, meetingController.getMeetingById);

/**
 * @route   PUT /api/meetings/:id
 * @desc    Update a meeting
 * @access  Private
 */
router.put("/:id", verifyToken, meetingController.updateMeeting);

/**
 * @route   DELETE /api/meetings/:id
 * @desc    Cancel a meeting
 * @access  Private
 */
router.delete("/:id", verifyToken, meetingController.cancelMeeting);

/**
 * @route   POST /api/meetings/:id/resend-invites
 * @desc    Resend meeting invitation emails
 * @access  Private
 */
router.post("/:id/resend-invites", verifyToken, meetingController.resendInvites);

module.exports = router;

