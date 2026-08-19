const tenantService = require("../services/tenant.service");

const createTenant = async (req, res, next) => {

    try {

        const tenant = await tenantService.createTenant(req.body);

        res.status(201).json({
            message: "Tenant created successfully",
            tenant
        });

    } catch (error) {

        next(error);

    }

};

module.exports = {
    createTenant
};