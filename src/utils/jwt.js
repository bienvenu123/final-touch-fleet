const jwt=require("jsonwebtoken");

const generateToken=(user)=>{
    const secret = process.env.JWT_SECRET || "super-secret-key";
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

    generateToken

}