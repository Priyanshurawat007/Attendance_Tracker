const User = require('../models/user.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

// 🔐 Generate Access Token
const generateToken = (user) => {
    return jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
    );
};

// 🧼 Remove sensitive data
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

// ✅ 1. CREATE ADMIN
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

// ✅ 2. CREATE STUDENT (Phone as ID + Desk Assignment)
exports.createStudent = async (req, res) => {
    try {
        const { name, phone, deskNumber } = req.body;

        if (!name || !phone || !deskNumber) {
            return res.status(400).json({ message: "Name, Phone, and Desk Number are required" });
        }

        // Check if phone (userId) is already taken
        const existingStudent = await User.findOne({ userId: phone });
        if (existingStudent) {
            return res.status(400).json({ message: "Student with this phone number already exists" });
        }

        // Check if desk is already occupied
        const deskOccupied = await User.findOne({ deskNumber });
        if (deskOccupied) {
            return res.status(400).json({ message: `Desk ${deskNumber} is already occupied by ${deskOccupied.name}` });
        }

        const hashedPassword = await bcrypt.hash("123456", 10); // Default Password

        const student = await User.create({
            name,
            userId: phone, // Phone is the Login ID
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

// ✅ 3. DELETE STUDENT (Frees up Desk & Phone ID)
exports.deleteStudent = async (req, res) => {
    try {
        const { id } = req.params; // Expecting Mongo ID

        const student = await User.findById(id);
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        if (student.role === 'ADMIN') {
            return res.status(403).json({ message: "Cannot delete an Admin account through this route" });
        }

        await User.findByIdAndDelete(id);

        res.json({ message: `Student ${student.name} deleted. Desk ${student.deskNumber} is now vacant.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 👨‍💼 ADMIN LOGIN (Step 1: OTP)
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

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: true,
            auth: { user: process.env.SMTP_USERNAME, pass: process.env.SMTP_PASSWORD },
        });

        await transporter.sendMail({
            from: `"Salon Junction Admin" <${process.env.SMTP_FROM}>`,
            to: admin.email,
            subject: "Your Admin Verification Code",
            html: `<h3>Your OTP: ${otp}</h3><p>Valid for 10 minutes.</p>`
        });

        res.json({ message: "OTP sent to your registered email." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 🔐 VERIFY ADMIN OTP (Step 2)
exports.verifyAdminOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const admin = await User.findOne({ email, role: 'ADMIN', otp, otpExpires: { $gt: Date.now() } });

        if (!admin) return res.status(400).json({ message: "Invalid or expired OTP" });

        admin.otp = undefined;
        admin.otpExpires = undefined;
        await admin.save();

        res.json({ message: "Login successful", token: generateToken(admin), user: sanitizeUser(admin) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 🎓 STUDENT LOGIN
exports.studentLogin = async (req, res) => {
    try {
        const { userId, password } = req.body;
        const student = await User.findOne({ userId, role: 'STUDENT' });

        if (!student || !(await bcrypt.compare(password, student.password))) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        res.json({ message: "Login successful", token: generateToken(student), user: sanitizeUser(student) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};