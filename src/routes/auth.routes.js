const router = require('express').Router();
const { adminLogin, studentLogin, createAdmin } = require('../controllers/auth.controller');

router.post('/admin/login', adminLogin);
router.post('/student/login', studentLogin);
router.post('/create-admin', createAdmin);

module.exports = router;