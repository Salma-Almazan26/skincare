"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const environment_1 = require("../config/environment");
class AuthService {
    static async hashPassword(password) {
        const salt = await bcryptjs_1.default.genSalt(10);
        return bcryptjs_1.default.hash(password, salt);
    }
    static async comparePassword(password, hash) {
        return bcryptjs_1.default.compare(password, hash);
    }
    static generateToken(payload) {
        return jsonwebtoken_1.default.sign(payload, environment_1.ENV.JWT_SECRET, {
            expiresIn: '24h',
        });
    }
    static verifyToken(token) {
        try {
            return jsonwebtoken_1.default.verify(token, environment_1.ENV.JWT_SECRET);
        }
        catch {
            return null;
        }
    }
}
exports.AuthService = AuthService;
