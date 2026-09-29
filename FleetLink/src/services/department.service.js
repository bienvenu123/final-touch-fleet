const prisma = require("../config/prisma");

const createDepartment = async (tenantId, data = {}) => {

    const name = typeof data.name === "string" ? data.name.trim() : "";
    if (!name) {
        const error = new Error("name is required");
        error.statusCode = 400;
        throw error;
    }

    const department = await prisma.department.create({

        data: {

            tenantId,

            name,

            costCentreCode: data.costCentreCode,

            budgetCode: data.budgetCode

        }

    });

    return department;

};

module.exports = {

    createDepartment

};
