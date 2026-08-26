const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = '24h';

function signToken(user) {
    return jwt.sign(
        { sub: user.id, email: user.email, role: user.role },
        SECRET,
        { expiresIn: EXPIRES_IN }
    );
}

function verifyToken(token) {
    return jwt.verify(token, SECRET);
}

module.exports = { signToken, verifyToken };
