const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../utils/logger');

class TokenService {
    constructor() {
        this.jwtSecret = process.env.JWT_SECRET;
        this.jwtExpire = process.env.JWT_EXPIRE || '24h';
        this.refreshSecret = process.env.JWT_REFRESH_SECRET;
        this.refreshExpire = process.env.JWT_REFRESH_EXPIRE || '7d';

        if (!this.jwtSecret || !this.refreshSecret) {
            throw new Error('JWT secrets must be defined in environment variables');
        }
    }

    /**
     * Genera un token JWT de acceso
     * @param {Object} payload - Datos del usuario
     * @returns {string} Token JWT
     */
    generateAccessToken(payload) {
        try {
            const tokenPayload = {
                userId: payload.id,
                email: payload.email,
                name: payload.name,
                roleId: payload.role_id,
                roleName: payload.role?.name || null,
                isActive: payload.is_active,
                iat: Math.floor(Date.now() / 1000),
            };

            return jwt.sign(tokenPayload, this.jwtSecret, {
                expiresIn: this.jwtExpire,
                issuer: process.env.APP_NAME || 'DTAI-PM',
                audience: 'dtai-users',
            });
        } catch (error) {
            logger.error('Error generating access token:', error);
            throw new Error('Error al generar token de acceso');
        }
    }

    /**
     * Genera un token de refresco
     * @param {Object} payload - Datos del usuario
     * @returns {string} Refresh token
     */
    generateRefreshToken(payload) {
        try {
            const tokenPayload = {
                userId: payload.id,
                email: payload.email,
                type: 'refresh',
                iat: Math.floor(Date.now() / 1000),
            };

            return jwt.sign(tokenPayload, this.refreshSecret, {
                expiresIn: this.refreshExpire,
                issuer: process.env.APP_NAME || 'DTAI-PM',
                audience: 'dtai-users',
            });
        } catch (error) {
            logger.error('Error generating refresh token:', error);
            throw new Error('Error al generar token de refresco');
        }
    }

    /**
     * Verifica un token JWT de acceso
     * @param {string} token - Token a verificar
     * @returns {Object} Payload del token
     */
    verifyAccessToken(token) {
        try {
            return jwt.verify(token, this.jwtSecret, {
                issuer: process.env.APP_NAME || 'DTAI-PM',
                audience: 'dtai-users',
            });
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('Token expirado');
            } else if (error.name === 'JsonWebTokenError') {
                throw new Error('Token inválido');
            } else {
                logger.error('Error verifying access token:', error);
                throw new Error('Error al verificar token');
            }
        }
    }

    /**
     * Verifica un token de refresco
     * @param {string} token - Token a verificar
     * @returns {Object} Payload del token
     */
    verifyRefreshToken(token) {
        try {
            const decoded = jwt.verify(token, this.refreshSecret, {
                issuer: process.env.APP_NAME || 'DTAI-PM',
                audience: 'dtai-users',
            });

            if (decoded.type !== 'refresh') {
                throw new Error('Token type invalid');
            }

            return decoded;
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('Token de refresco expirado');
            } else if (error.name === 'JsonWebTokenError') {
                throw new Error('Token de refresco inválido');
            } else {
                logger.error('Error verifying refresh token:', error);
                throw new Error('Error al verificar token de refresco');
            }
        }
    }

    /**
     * Genera un token aleatorio para reset de contraseña
     * @returns {string} Token aleatorio
     */
    generateResetToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Genera un token para verificación de email
     * @returns {string} Token de verificación
     */
    generateVerificationToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Decodifica un token sin verificar la firma (útil para debugging)
     * @param {string} token - Token a decodificar
     * @returns {Object} Payload del token
     */
    decodeToken(token) {
        try {
            return jwt.decode(token, { complete: true });
        } catch (error) {
            logger.error('Error decoding token:', error);
            return null;
        }
    }

    /**
     * Verifica si un token está próximo a expirar
     * @param {string} token - Token a verificar
     * @param {number} minutesThreshold - Minutos de umbral
     * @returns {boolean} True si está próximo a expirar
     */
    isTokenExpiringSoon(token, minutesThreshold = 5) {
        try {
            const decoded = this.decodeToken(token);
            if (!decoded || !decoded.payload.exp) return false;

            const expirationTime = decoded.payload.exp * 1000;
            const currentTime = Date.now();
            const timeUntilExpiration = expirationTime - currentTime;
            const thresholdTime = minutesThreshold * 60 * 1000;

            return timeUntilExpiration <= thresholdTime;
        } catch (error) {
            logger.error('Error checking token expiration:', error);
            return false;
        }
    }

    /**
     * Obtiene el tiempo restante del token en segundos
     * @param {string} token - Token a verificar
     * @returns {number} Segundos restantes
     */
    getTokenRemainingTime(token) {
        try {
            const decoded = this.decodeToken(token);
            if (!decoded || !decoded.payload.exp) return 0;

            const expirationTime = decoded.payload.exp * 1000;
            const currentTime = Date.now();
            const remainingTime = Math.max(0, expirationTime - currentTime);

            return Math.floor(remainingTime / 1000);
        } catch (error) {
            logger.error('Error getting token remaining time:', error);
            return 0;
        }
    }

    /**
     * Genera un par de tokens (access + refresh)
     * @param {Object} user - Datos del usuario
     * @returns {Object} Objeto con ambos tokens
     */
    generateTokenPair(user) {
        const accessToken = this.generateAccessToken(user);
        const refreshToken = this.generateRefreshToken(user);

        return {
            accessToken,
            refreshToken,
            tokenType: 'Bearer',
            expiresIn: this.jwtExpire,
        };
    }
}

module.exports = new TokenService();