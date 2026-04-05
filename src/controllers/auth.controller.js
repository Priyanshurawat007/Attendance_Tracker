const User = require('../models/user.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

// 🔐 Helper: Generate Access Token
const generateToken = (user) => {
    return jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
    );
};

// 🧼 Helper: Remove sensitive data
const sanitizeUser = (user) => {
    return {
        id: user._id,
        name: user.name,
        userId: user.userId,
        email: user.email,
        role: user.role,
        deskNumber: user.deskNumber,
        phone: user.phone
    };
};

// ✅ 1. CREATE ADMIN (Initial Setup)
exports.createAdmin = async (req, res) => {
    try {
        const { name, email, password, secretKey } = req.body;

        if (secretKey !== process.env.ADMIN_SECRET) {
            return res.status(403).json({ message: "Unauthorized to create admin" });
        }

        const existingAdmin = await User.findOne({ email });
        if (existingAdmin) {
            return res.status(400).json({ message: "Admin already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const admin = await User.create({
            name,
            email,
            password: hashedPassword,
            role: 'ADMIN',
            userId: `ADMIN-${Date.now()}` 
        });

        res.json({
            message: "Admin created successfully",
            admin: sanitizeUser(admin)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ✅ 2. CREATE STUDENT (Admin Action)
exports.createStudent = async (req, res) => {
    try {
        const { name, phone, deskNumber } = req.body;

        if (!name || !phone || !deskNumber) {
            return res.status(400).json({ message: "Name, Phone, and Desk Number are required" });
        }

        const existingStudent = await User.findOne({ userId: phone });
        if (existingStudent) {
            return res.status(400).json({ message: "Student with this phone number already exists" });
        }

        const deskOccupied = await User.findOne({ deskNumber });
        if (deskOccupied) {
            return res.status(400).json({ message: `Desk ${deskNumber} is already occupied by ${deskOccupied.name}` });
        }

        const hashedPassword = await bcrypt.hash("123456", 10); 

        const student = await User.create({
            name,
            userId: phone, 
            phone,
            deskNumber,
            password: hashedPassword,
            role: 'STUDENT'
        });

        res.status(201).json({
            message: "Student registered successfully",
            student: sanitizeUser(student)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ✅ 3. DELETE STUDENT (Admin Action)
exports.deleteStudent = async (req, res) => {
    try {
        const { id } = req.params; 

        const student = await User.findById(id);
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        if (student.role === 'ADMIN') {
            return res.status(403).json({ message: "Cannot delete an Admin account" });
        }

        await User.findByIdAndDelete(id);

        res.json({ message: `Student ${student.name} deleted. Desk ${student.deskNumber} is now vacant.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 👨‍💼 4. ADMIN LOGIN (Step 1: OTP)
exports.adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await User.findOne({ email, role: 'ADMIN' });

        if (!admin || !(await bcrypt.compare(password, admin.password))) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        admin.otp = otp;
        admin.otpExpires = Date.now() + 10 * 60 * 1000;
        await admin.save();

        // 🚀 NODEMAILER CONFIG WITH IPv4 FIX
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || "smtp.gmail.com",
            port: process.env.SMTP_PORT || 465,
            secure: true, 
            auth: { 
                user: process.env.SMTP_USERNAME, 
                pass: process.env.SMTP_PASSWORD 
            },
            tls: {
                family: 4 // FORCES IPv4 to prevent ENETUNREACH errors on Render/Vercel
            }
        });

        // Send Email with sub-try-catch to prevent 500 crashing the whole login
        try {
            await transporter.sendMail({
                from: `"Junoon Library Admin" <${process.env.SMTP_FROM}>`,
                to: admin.email,
                subject: "Your Admin Verification Code",
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd;">
                        <h2 style="color: #00b894;">Admin Verification</h2>
                        <p>Your OTP for dashboard access is:</p>
                        <h1 style="letter-spacing: 5px; color: #333;">${otp}</h1>
                        <p>This code is valid for 10 minutes. Do not share it with anyone.</p>
                    </div>
                `
            });
            res.json({ message: "OTP sent to your registered email." });
        } catch (mailErr) {
            console.error("Email Transport Error:", mailErr);
            return res.status(503).json({ error: "Email service unavailable. Please check SMTP settings." });
        }

    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ error: err.message });
    }
};

// 🔐 5. VERIFY ADMIN OTP (Step 2)
exports.verifyAdminOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const admin = await User.findOne({ 
            email, 
            role: 'ADMIN', 
            otp, 
            otpExpires: { $gt: Date.now() } 
        });

        if (!admin) return res.status(400).json({ message: "Invalid or expired OTP" });

        // Clear OTP after success
        admin.otp = undefined;
        admin.otpExpires = undefined;
        await admin.save();

        res.json({ 
            message: "Login successful", 
            token: generateToken(admin), 
            user: sanitizeUser(admin) 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 🎓 6. STUDENT LOGIN
exports.studentLogin = async (req, res) => {
    try {
        const { userId, password } = req.body;
        const student = await User.findOne({ userId, role: 'STUDENT' });

        if (!student || !(await bcrypt.compare(password, student.password))) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        res.json({ 
            message: "Login successful", 
            token: generateToken(student), 
            user: sanitizeUser(student) 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 🔑 7. RESET PASSWORD (Admin Action)
exports.resetStudentPassword = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findOne({ userId: userId });
        if (!user) {
            return res.status(404).json({ error: "Student not found" });
        }

        const newPassword = "123456";
        const hashed = await bcrypt.hash(newPassword, 10);

        user.password = hashed;
        await user.save();

        res.json({
            message: "Password reset successful",
            newPassword
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};