const jwt = require("jsonwebtoken");
const { getJwtSecret } = require("../utils/jwt");

const authMiddleware = (req, res, next) => {

    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            message: "Unauthorized"
        });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            message: "Unauthorized"
        });
    }

    try {
        const secret = getJwtSecret();
        const decoded = jwt.verify(
            token,
            secret
        );

        req.user = decoded;

        next();

    } catch (error) {

        return res.status(401).json({
            message: "Invalid token"
        });

    }

};

module.exports = authMiddleware;
