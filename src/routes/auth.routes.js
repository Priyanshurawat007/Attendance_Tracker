const router = require('express').Router();
const { adminLogin, studentLogin, createAdmin, verifyAdminOTP, deleteStudent } = require('../controllers/auth.controller');

router.post('/admin/login', adminLogin);
router.post('/student/login', studentLogin);
router.post('/create-admin', createAdmin);
router.post('/verify-admin',verifyAdminOTP);
router.delete('/delete-student/:id',deleteStudent);

module.exports = router;