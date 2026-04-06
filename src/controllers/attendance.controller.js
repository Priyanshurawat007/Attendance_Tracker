const Attendance = require('../models/attendance.model');
const User = require('../models/user.model');
const bcrypt = require('bcryptjs');

/**
 * HELPER: Get current date in YYYY-MM-DD format (Indian Standard Time)
 * Ensures that even if the server is in the US, "today" follows India's clock.
 */
const getISTDate = () => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

// ✅ CHECK-IN (Protected)
exports.checkIn = async (req, res) => {
    try {
        const studentId = req.user.id;
        const today = getISTDate(); 

        let record = await Attendance.findOne({ student: studentId, date: today });

        if (record) {
            return res.status(400).json({ message: "Already checked in today" });
        }

        record = await Attendance.create({
            student: studentId,
            date: today,
            checkIn: new Date(), // Automatically stored as UTC in MongoDB
            status: 'PRESENT'
        });

        res.json({ message: "Checked In successfully", record });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ✅ CHECK-OUT (Protected)
exports.checkOut = async (req, res) => {
    try {
        const studentId = req.user.id;
        const today = getISTDate();

        const record = await Attendance.findOne({ student: studentId, date: today });

        if (!record) {
            return res.status(400).json({ message: "Please check-in first" });
        }

        if (record.checkOut) {
            return res.status(400).json({ message: "Already checked out" });
        }

        record.checkOut = new Date();

        // Calculate hours difference (milliseconds to hours)
        const hours = (record.checkOut - record.checkIn) / (1000 * 60 * 60);
        record.totalHours = Number(hours.toFixed(2));

        // Logic: Less than 4 hours is a Half Day
        record.status = hours < 4 ? 'HALF_DAY' : 'PRESENT';

        await record.save();

        res.json({ message: "Checked Out successfully", record });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ✅ GET CALENDAR (No Auth Required)
exports.getStudentCalendar = async (req, res) => {
    try {
        const { studentId, month, year } = req.query;

        if (!studentId || !month || !year) {
            return res.status(400).json({ message: "studentId, month and year are required" });
        }

        const monthStr = String(month).padStart(2, '0');

        const records = await Attendance.find({
            student: studentId,
            date: { $regex: `^${year}-${monthStr}` }
        }).select('date status checkIn checkOut totalHours');

        const map = {};
        records.forEach(r => {
            map[r.date] = {
                status: r.status,
                // Convert UTC timestamps to IST human-readable strings
                checkIn: r.checkIn ? new Date(r.checkIn).toLocaleTimeString('en-IN', { 
                    timeZone: 'Asia/Kolkata',
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: true 
                }) : null,
                checkOut: r.checkOut ? new Date(r.checkOut).toLocaleTimeString('en-IN', { 
                    timeZone: 'Asia/Kolkata',
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: true 
                }) : null,
                totalHours: r.totalHours || 0
            };
        });

        const calendar = [];
        // Get total days in the requested month
        const daysInMonth = new Date(year, month, 0).getDate();

        for (let i = 1; i <= daysInMonth; i++) {
            const day = `${year}-${monthStr}-${String(i).padStart(2, '0')}`;
            const rec = map[day] || { status: 'ABSENT', checkIn: null, checkOut: null, totalHours: 0 };

            calendar.push({
                date: day,
                status: rec.status,
                checkIn: rec.checkIn,
                checkOut: rec.checkOut,
                totalHours: rec.totalHours
            });
        }

        res.json(calendar);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ✅ GET ATTENDANCE PERCENTAGE (No Auth Required)
exports.getAttendancePercentage = async (req, res) => {
    try {
        const { studentId } = req.query;

        if (!studentId) {
            return res.status(400).json({ message: "studentId is required" });
        }

        const records = await Attendance.find({ student: studentId });

        const totalDays = records.length;
        const presentDays = records.filter(r => 
            ['PRESENT', 'HALF_DAY'].includes(r.status)
        ).length;

        const percentage = totalDays === 0 
            ? 0 
            : ((presentDays / totalDays) * 100).toFixed(2);

        res.json({
            totalDays,
            presentDays,
            percentage: Number(percentage)
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// ✅ CHANGE PASSWORD (Protected)
exports.changePassword = async (req, res) => {
    try {
        const userId = req.user.id;
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            return res.status(400).json({ message: "All fields required" });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Old password incorrect" });
        }

        // Hash the new password before saving
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        res.json({ message: "Password changed successfully" });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
