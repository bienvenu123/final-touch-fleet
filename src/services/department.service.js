const prisma = require("../config/prisma");

const createDepartment = async (data) => {

    const department = await prisma.department.create({

        data: {

            tenantId: data.tenantId,

            name: data.name,

            costCentreCode: data.costCentreCode,

            budgetCode: data.budgetCode

        }

    });

    return department;

};

module.exports = {

    createDepartment

};