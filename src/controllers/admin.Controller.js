const User = require('../models/user.model');
const Attendance = require('../models/attendance.model');
const bcrypt = require('bcryptjs');
const generateUserId = require('../utils/generateUserId');

// ✅ CREATE STUDENT
exports.createStudent = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ message: "Name required" });
        }

        const userId = await generateUserId(name);
        const password = await bcrypt.hash("123456", 10);

        const student = await User.create({
            name,
            userId,
            password,
            role: 'STUDENT'
        });

        res.json({
            message: "Student created",
            userId: student.userId,
            defaultPassword: "123456"
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getDashboard = async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const students = await User.find({ role: 'STUDENT' });

        const attendanceRecords = await Attendance.find({ date: today })
            .populate('student', 'name userId');

        const attendanceMap = {};
        attendanceRecords.forEach(record => {
            attendanceMap[record.student._id] = record;
        });

        const fullData = students.map(student => {
            const record = attendanceMap[student._id];

            return {
                name: student.name,
                userId: student.userId,
                status: record ? record.status : 'ABSENT',
                checkIn: record?.checkIn || null,
                checkOut: record?.checkOut || null,
                totalHours: record?.totalHours || 0
            };
        });

        const present = fullData.filter(s => s.status === 'PRESENT').length;
        const halfDay = fullData.filter(s => s.status === 'HALF_DAY').length;
        const absent = fullData.filter(s => s.status === 'ABSENT').length;

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
        const { studentId } = req.params;

        const newPassword = "123456";
        const hashed = await bcrypt.hash(newPassword, 10);

        await User.findByIdAndUpdate(studentId, { password: hashed });

        res.json({
            message: "Password reset successful",
            newPassword
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};