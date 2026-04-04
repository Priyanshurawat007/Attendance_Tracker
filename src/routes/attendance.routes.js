// routes/attendance.routes.js

const router = require('express').Router();
const auth = require('../middleware/auth.middleware');

const { 
    checkIn, 
    checkOut, 
    changePassword,
    getStudentCalendar, 
    getAttendancePercentage 
} = require('../controllers/attendance.controller');

// Protected routes
router.post('/check-in', auth, checkIn);
router.post('/check-out', auth, checkOut);

// Public routes (no auth)
router.get('/calendar', getStudentCalendar);
router.get('/percentage', getAttendancePercentage);

// Change Password - Protected
router.put('/change-password', auth, changePassword);

module.exports = router;