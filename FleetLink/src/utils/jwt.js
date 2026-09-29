const jwt=require("jsonwebtoken");

function getJwtSecret() {
    if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
    if (process.env.NODE_ENV === "production") {
        const error = new Error("JWT_SECRET must be configured in production");
        error.statusCode = 500;
        throw error;
    }
    return "super-secret-key";
}

const generateToken=(user)=>{
    const secret = getJwtSecret();
    const expiresIn = process.env.JWT_EXPIRES_IN || "7d";

    return jwt.sign(
        {
            userId: user.id,
            id: user.id,
            email: user.email,
            tenantId: user.tenantId,
            role: user.role,
            sub: user.id,
        },
        secret,
        {
            expiresIn
        }
    );
}

module.exports={

    generateToken,
    getJwtSecret

}
