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

// This endpoint is safe for a public mobile app: it can create only CUSTOMER
// accounts in the tenant that publishes the public fleet.
const signupCustomer = async (data = {}) => {
    const name = typeof data.name === "string" ? data.name.trim() : "";
    const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
    const password = typeof data.password === "string" ? data.password : "";
    const contact = typeof data.contact === "string" ? data.contact.trim() : null;
    const tenantId = process.env.PUBLIC_TENANT_ID?.trim();

    if (!tenantId) {
        const error = new Error("Customer registration is not configured");
        error.statusCode = 503;
        throw error;
    }
    if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) {
        const error = new Error("Name, a valid email, and a password of at least 8 characters are required");
        error.statusCode = 400;
        throw error;
    }
    if (await prisma.user.findUnique({ where: { email } })) {
        const error = new Error("An account already exists for this email. Please sign in.");
        error.statusCode = 400;
        throw error;
    }

    const user = await prisma.user.create({
        data: { tenantId, name, email, password: await hashPassword(password), contact, role: "CUSTOMER" },
    });
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
    signupCustomer,
    login
};
