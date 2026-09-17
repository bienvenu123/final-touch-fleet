const authService = require("../services/auth.service");

const signup = async (req, res, next) => {
    try {

        const user = await authService.signup(req.body);

        res.status(201).json({
            message: "User created successfully",
            user
        });

    } catch (error) {
        next(error);
    }
};

const signupCustomer = async (req, res, next) => {
    try {
        const user = await authService.signupCustomer(req.body);
        res.status(201).json({ message: "Customer account created successfully", user });
    } catch (error) {
        next(error);
    }
};

const login = async (req, res, next) => {

    try {

        const result = await authService.login(req.body);

        res.status(200).json(result);

    } catch (error) {

        next(error);

    }

};

module.exports = {
    signup,
    signupCustomer,
    login
};
