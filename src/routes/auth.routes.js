const router = require('express').Router();
const { 
    adminLogin, 
    studentLogin, 
    createAdmin, 
    setup2FA,           // New: To get the QR code
    verifyAndEnable2FA,  // New: To lock in the 2FA setup
    deleteStudent,
    resetStudentPassword // New: Added the reset logic
} = require('../controllers/auth.controller');

// 🔐 Admin Auth & 2FA Setup
router.post('/create-admin', createAdmin);
router.post('/admin/setup-2fa', setup2FA);           // Hit this once to get your QR code
router.post('/admin/verify-2fa', verifyAndEnable2FA); // Hit this to enable 2FA
router.post('/admin/login', adminLogin);             // Now expects {email, password, token}

// 🎓 Student Management
router.post('/student/login', studentLogin);
router.delete('/delete-student/:id', deleteStudent);
router.put('/reset-password/:userId', resetStudentPassword); // Fixed: Added this route

module.exports = router;