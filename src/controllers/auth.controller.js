const User = require('../models/user.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
        role: user.role
    };
};

// ✅ CREATE ADMIN
exports.createAdmin = async (req, res) => {
    try {
        const { name, email, password, secretKey } = req.body;

        // 🔐 SECURITY CHECK (VERY IMPORTANT)
        if (secretKey !== process.env.ADMIN_SECRET) {
            return res.status(403).json({ message: "Unauthorized to create admin" });
        }

        if (!name || !email || !password) {
            return res.status(400).json({ message: "All fields required" });
        }

        // ✅ Check if admin already exists
        const existingAdmin = await User.findOne({ email });
        if (existingAdmin) {
            return res.status(400).json({ message: "Admin already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const admin = await User.create({
            name,
            email,
            password: hashedPassword,
            role: 'ADMIN'
        });

        res.json({
            message: "Admin created successfully",
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email
            }
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


// ## 👨‍💼 ADMIN LOGIN
exports.adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // ✅ Validation
        if (!email || !password) {
            return res.status(400).json({ message: "Email & password required" });
        }

        const admin = await User.findOne({ email, role: 'ADMIN' });
        if (!admin) {
            return res.status(404).json({ message: "Admin not found" });
        }

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const token = generateToken(admin);

        res.json({
            message: "Login successful",
            token,
            user: sanitizeUser(admin)
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ## 🎓 STUDENT LOGIN
exports.studentLogin = async (req, res) => {
    try {
        const { userId, password } = req.body;

        // ✅ Validation
        if (!userId || !password) {
            return res.status(400).json({ message: "userId & password required" });
        }

        const student = await User.findOne({ userId, role: 'STUDENT' });
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }

        const isMatch = await bcrypt.compare(password, student.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const token = generateToken(student);

        res.json({
            message: "Login successful",
            token,
            user: sanitizeUser(student)
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};