const departmentService = require("../services/department.service");

const createDepartment = async (req, res, next) => {

    try {

        const department = await departmentService.createDepartment(req.body);

        res.status(201).json({

            message: "Department created successfully",

            department

        });

    } catch (error) {

        next(error);

    }

};

module.exports = {

    createDepartment

};