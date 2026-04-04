const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: String // Format: "2026-04-05"
    },
    checkIn: {
        type: Date
    },
    checkOut: {
        type: Date
    },
    totalHours: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['PRESENT', 'ABSENT', 'HALF_DAY'], // Added HALF_DAY here
        default: 'ABSENT'
    }
}, { timestamps: true });

module.exports = mongoose.model('Attendance', attendanceSchema);