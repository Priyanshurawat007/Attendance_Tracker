const router = require('express').Router();
const auth = require('../middleware/auth.middleware');
const role = require('../middleware/role.middleware');

const {
    createStudent,
    getDashboard,
    resetStudentPassword
} = require('../controllers/admin.Controller');

router.post('/create-student', auth, role('ADMIN'), createStudent);

router.get('/dashboard', auth, role('ADMIN'), getDashboard);

router.post('/reset-password/:studentId', auth, role('STUDENT'), resetStudentPassword);

module.exports = router;