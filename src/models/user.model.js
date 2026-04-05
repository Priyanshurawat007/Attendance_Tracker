const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },

    // Used for Student Login (Phone Number)
    userId: {
        type: String,
        unique: true, 
        sparse: true, // Important: Allows Admins to exist without a numeric userId
        trim: true
    },

    // Primary contact (Required for Admins to receive OTP)
    email: {
        type: String,
        unique: true,
        sparse: true,
        lowercase: true,
        trim: true
    },

    password: {
        type: String,
        required: true
    },

    role: {
        type: String,
        enum: ['ADMIN', 'STUDENT'],
        default: 'STUDENT'
    },

    // --- 🪑 MANAGEMENT FIELDS ---
    phone: {
        type: String,
        trim: true
        // Usually same as userId for students
    },

    deskNumber: {
        type: String,
        unique: true, // Prevents two students from being assigned the same seat
        sparse: true, // Allows users (like Admins) to NOT have a desk assigned
        trim: true
    },

    // --- 🔐 2FA / SECURITY FIELDS ---
    otp: { 
        type: String 
    },
    
    otpExpires: { 
        type: Date 
    }

}, { 
    timestamps: true // Automatically creates createdAt and updatedAt fields
});

// Create a custom index for cleaner lookups if needed
module.exports = mongoose.model('User', userSchema);