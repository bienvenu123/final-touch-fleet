const errorHandler = (err, req, res, next) => {

    console.error(err.message);

    if (err.message === "Invalid credentials") {

        return res.status(401).json({
            message: err.message
        });

    }

    if (err.message === "Email already exists") {

        return res.status(400).json({
            message: err.message
        });

    }

    if (err.statusCode) {
        return res.status(err.statusCode).json({ message: err.message });
    }

    return res.status(500).json({
        message: process.env.NODE_ENV === "production" ? "Internal Server Error" : err.message || "Internal Server Error"
    });

};

module.exports = errorHandler;
