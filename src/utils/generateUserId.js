const User = require('../models/user.model');

const generateUserId = async (name) => {
    const count = await User.countDocuments();
    const prefix = name.substring(0, 4).toUpperCase();
    return `${prefix}${(count + 1).toString().padStart(3, '0')}`;
};

module.exports = generateUserId;

