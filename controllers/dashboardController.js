const pool = require("../config/db");

exports.getDashboard = async (req, res) => {

    try {

        res.json({
            success: true,
            data: {
                totalEmployee: 0,
                present: 0,
                leave: 0,
                late: 0,
                chart: [],
                attendance: []
            }
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};