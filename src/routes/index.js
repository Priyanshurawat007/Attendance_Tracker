const router = require('express').Router();

router.use('/auth', require('./auth.routes'));
router.use('/admin', require('./admin.routes'));
router.use('/attendance', require('./attendance.routes'));

module.exports = router;