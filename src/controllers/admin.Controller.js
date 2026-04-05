const User = require('../models/user.model');
const Attendance = require('../models/attendance.model');
const bcrypt = require('bcryptjs');
const generateUserId = require('../utils/generateUserId');

// ✅ CREATE STUDENT
exports.createStudent = async (req, res) => {
    try {
        // 1. Get phone and deskNumber from request body
        const { name, phone, deskNumber } = req.body;

        // 2. Validation
        if (!name || !phone || !deskNumber) {
            return res.status(400).json({ 
                message: "Name, Phone (UserId), and Desk Number are required" 
            });
        }

        // 3. Check if the Phone Number (UserId) is already registered
        const existingUser = await User.findOne({ userId: phone });
        if (existingUser) {
            return res.status(400).json({ message: "Phone number already registered" });
        }

        // 4. Check if the Desk/Chair is already taken
        const deskOccupied = await User.findOne({ deskNumber });
        if (deskOccupied) {
            return res.status(400).json({ 
                message: `Desk ${deskNumber} is already assigned to ${deskOccupied.name}` 
            });
        }

        const hashedPassword = await bcrypt.hash("123456", 10);

        // 5. Create the Student
        const student = await User.create({
            name,
            userId: phone, // Phone number acts as the unique login ID
            password: hashedPassword,
            role: 'STUDENT',
            phone,         // Store in phone field as well
            deskNumber     // Store the assigned chair/desk number
        });

        res.json({
            message: "Student created successfully",
            userId: student.userId,
            deskNumber: student.deskNumber,
            defaultPassword: "123456"
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getDashboard = async (req, res) => {
    try {
        // 1. Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];

        // 2. Fetch all students - Ensure 'deskNumber' is included
        const students = await User.find({ role: 'STUDENT' }).select('name userId deskNumber');

        // 3. Fetch today's attendance records
        const attendanceRecords = await Attendance.find({ date: today })
            .populate('student', 'name userId deskNumber');

        // 4. Create a map for quick attendance lookup
        const attendanceMap = {};
        attendanceRecords.forEach(record => {
            if (record.student) {
                attendanceMap[record.student._id.toString()] = record;
            }
        });

        // 5. Merge Student data with Attendance data
        const fullData = students.map(student => {
            const record = attendanceMap[student._id.toString()];

            return {
                id: student._id,
                name: student.name,
                userId: student.userId,
                deskNumber: student.deskNumber || "N/A", // 
                status: record ? record.status : 'ABSENT',
                checkIn: record?.checkIn || null,
                phoneNumber:student.phone || "NA",
                checkOut: record?.checkOut || null,
                totalHours: record?.totalHours || 0
            };
        });

        // 6. Calculate Summary Statistics
        const present = fullData.filter(s => s.status === 'PRESENT').length;
        const halfDay = fullData.filter(s => s.status === 'HALF_DAY').length;
        const absent = fullData.filter(s => s.status === 'ABSENT').length;

        // 7. Send Response
        res.json({
            summary: {
                totalStudents: students.length,
                present,
                halfDay,
                absent
            },
            chartData: [
                { label: 'Present', value: present },
                { label: 'Half Day', value: halfDay },
                { label: 'Absent', value: absent }
            ],
            students: fullData
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// RESET PASSWORD (ADMIN)
exports.resetStudentPassword = async (req, res) => {
    try {
        const { userId } = req.params;

        // 1. Check if user exists first
        const user = await User.findOne({ userId: userId });
        if (!user) {
            return res.status(404).json({ error: "Student not found" });
        }

        // 2. Hash and update
        const newPassword = "123456";
        const hashed = await bcrypt.hash(newPassword, 10);

        user.password = hashed;
        await user.save(); // Using .save() is generally safer in Mongoose

        res.json({
            message: "Password reset successful",
            newPassword
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};