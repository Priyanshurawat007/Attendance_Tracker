const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: String,

    userId: {
        type: String,
        unique: true // used for student login
    },

    email: String, // only for admin

    password: String,

    role: {
        type: String,
        enum: ['ADMIN', 'STUDENT'],
        default: 'STUDENT'
    }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);