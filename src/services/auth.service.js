const prisma = require("../config/prisma");
const { hashPassword, comparePassword } = require("../utils/hash");
const { generateToken } = require("../utils/jwt");

const signup = async (data) => {
    const {
        name,
        email,
        password,
        role,
        tenantId,
        departmentId,
        contact,
        notificationPreferences
    } = data;

    const existingUser = await prisma.user.findUnique({
        where: {
            email
        }
    });

    if (existingUser) {
        throw new Error("Email already exists");
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
        data: {
            name,
            email,
            password: hashedPassword,
            role,
            tenantId,
            departmentId,
            contact,
            notificationPreferences
        }
    });

    // Never return password
    delete user.password;

    return user;
};

const login = async (data) => {

    const { email, password } = data;

    const user = await prisma.user.findUnique({
        where: {
            email
        }
    });

    if (!user) {
        throw new Error("Invalid credentials");
    }

    const validPassword = await comparePassword(
        password,
        user.password
    );

    if (!validPassword) {
        throw new Error("Invalid credentials");
    }

    const token = generateToken(user);

    return {
        token,
        user: {
            id: user.id,
            name: user.name,
            role: user.role,
            tenantId: user.tenantId
        }
    };
};

module.exports = {
    signup,
    login
};
