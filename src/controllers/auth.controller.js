const User = require('../models/user.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

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
        phone: user.phone,
        isTwoFactorEnabled: user.isTwoFactorEnabled
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
            message: "Admin created successfully. Please set up 2FA now.",
            admin: sanitizeUser(admin)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ✅ 2. GENERATE 2FA QR CODE (Admin Setup)
// Call this once from your frontend to "link" the app
exports.setup2FA = async (req, res) => {
    try {
        const { email } = req.body;
        const admin = await User.findOne({ email, role: 'ADMIN' });

        if (!admin) return res.status(404).json({ message: "Admin not found" });

        // Generate a unique secret for this admin
        const secret = speakeasy.generateSecret({
            name: `Junoon Library (${admin.email})`
        });

        // Save secret to DB (temporary until verified)
        admin.twoFactorSecret = secret.base32;
        await admin.save();

        // Generate QR code to scan in Google Authenticator
        const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

        res.json({ 
            qrCode: qrCodeUrl, 
            secret: secret.base32, // Backup code
            message: "Scan this QR code in Google Authenticator" 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ✅ 3. VERIFY & ENABLE 2FA
// Finalizes the setup by checking the first code from the app
exports.verifyAndEnable2FA = async (req, res) => {
    try {
        const { email, token } = req.body;
        const admin = await User.findOne({ email });

        const verified = speakeasy.totp.verify({
            secret: admin.twoFactorSecret,
            encoding: 'base32',
            token: token
        });

        if (verified) {
            admin.isTwoFactorEnabled = true;
            await admin.save();
            res.json({ message: "2FA Enabled successfully" });
        } else {
            res.status(400).json({ message: "Invalid code. Setup failed." });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 👨‍💼 4. ADMIN LOGIN (Using 6-digit App Code)
exports.adminLogin = async (req, res) => {
    try {
        const { email, password, token } = req.body; // token is from the Authenticator app
        const admin = await User.findOne({ email, role: 'ADMIN' });

        if (!admin || !(await bcrypt.compare(password, admin.password))) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        // Check if 2FA is set up
        if (!admin.isTwoFactorEnabled) {
            return res.status(403).json({ message: "2FA setup required", setupRequired: true });
        }

        // Verify the 6-digit code mathematically (No Email/Network needed!)
        const verified = speakeasy.totp.verify({
            secret: admin.twoFactorSecret,
            encoding: 'base32',
            token: token,
            window: 1 // Allows for 30-second clock drift
        });

        if (!verified) {
            return res.status(400).json({ message: "Invalid Authenticator code" });
        }

        res.json({ 
            message: "Login successful", 
            token: generateToken(admin), 
            user: sanitizeUser(admin) 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ✅ 5. CREATE STUDENT (Admin Action)
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

// ✅ 6. DELETE STUDENT (Admin Action)
exports.deleteStudent = async (req, res) => {
    try {
        const { id } = req.params; 
        const student = await User.findById(id);
        if (!student) return res.status(404).json({ message: "Student not found" });

        await User.findByIdAndDelete(id);
        res.json({ message: `Student deleted. Desk ${student.deskNumber} vacant.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 🎓 7. STUDENT LOGIN
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

// 🔑 8. RESET PASSWORD (Admin Action)
exports.resetStudentPassword = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findOne({ userId: userId });
        if (!user) return res.status(404).json({ error: "Student not found" });

        user.password = await bcrypt.hash("123456", 10);
        await user.save();

        res.json({ message: "Password reset to 123456" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};