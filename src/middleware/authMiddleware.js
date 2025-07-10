const tokenService = require('../services/tokenService');
const User = require('../models/User');
const Role = require('../models/Role');
const logger = require('../utils/logger');

/**
 * Middleware para verificar autenticación JWT
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 */
const authenticate = async (req, res, next) => {
    try {
        // Obtener token del header Authorization
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Token de acceso requerido',
                code: 'MISSING_TOKEN',
            });
        }

        const token = authHeader.substring(7); // Remover "Bearer "

        // Verificar token
        const decoded = tokenService.verifyAccessToken(token);

        // Verificar que el usuario existe y está activo
        const user = await User.findByPk(decoded.userId, {
            include: [{
                model: Role,
                as: 'role',
                attributes: ['id', 'name', 'description'],
            }],
        });

        if (!user || !user.is_active) {
            return res.status(401).json({
                error: 'Usuario no encontrado o inactivo',
                code: 'INVALID_USER',
            });
        }

        // Agregar información del usuario a la request
        req.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            roleId: user.role_id,
            roleName: user.role.name,
            isActive: user.is_active,
            emailVerified: user.email_verified,
        };

        // Verificar si el token está próximo a expirar
        if (tokenService.isTokenExpiringSoon(token)) {
            res.set('X-Token-Expiring', 'true');
        }

        next();
    } catch (error) {
        logger.error('Authentication error:', error);

        let errorMessage = 'Error de autenticación';
        let errorCode = 'AUTH_ERROR';

        if (error.message === 'Token expirado') {
            errorMessage = 'Token expirado';
            errorCode = 'TOKEN_EXPIRED';
        } else if (error.message === 'Token inválido') {
            errorMessage = 'Token inválido';
            errorCode = 'INVALID_TOKEN';
        }

        return res.status(401).json({
            error: errorMessage,
            code: errorCode,
        });
    }
};

/**
 * Middleware opcional para autenticación (no requiere token)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.substring(7);

        try {
            const decoded = tokenService.verifyAccessToken(token);

            const user = await User.findByPk(decoded.userId, {
                include: [{
                    model: Role,
                    as: 'role',
                    attributes: ['id', 'name', 'description'],
                }],
            });

            if (user && user.is_active) {
                req.user = {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    roleId: user.role_id,
                    roleName: user.role.name,
                    isActive: user.is_active,
                    emailVerified: user.email_verified,
                };
            }
        } catch (error) {
            // Si hay error en el token, simplemente continuar sin usuario
            logger.warn('Optional auth token error:', error.message);
        }

        next();
    } catch (error) {
        logger.error('Optional auth error:', error);
        next();
    }
};

/**
 * Middleware para verificar email verificado
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 */
const requireEmailVerification = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            error: 'Autenticación requerida',
            code: 'AUTH_REQUIRED',
        });
    }

    if (!req.user.emailVerified) {
        return res.status(403).json({
            error: 'Email no verificado',
            code: 'EMAIL_NOT_VERIFIED',
            message: 'Debes verificar tu email antes de acceder a esta funcionalidad',
        });
    }

    next();
};

/**
 * Middleware para verificar que el usuario es el propietario del recurso
 * @param {string} userIdParam - Nombre del parámetro que contiene el ID del usuario
 * @returns {Function} Middleware function
 */
const requireOwnership = (userIdParam = 'userId') => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Autenticación requerida',
                code: 'AUTH_REQUIRED',
            });
        }

        const resourceUserId = parseInt(req.params[userIdParam]);

        if (req.user.id !== resourceUserId) {
            return res.status(403).json({
                error: 'No tienes permisos para acceder a este recurso',
                code: 'INSUFFICIENT_PERMISSIONS',
            });
        }

        next();
    };
};

/**
 * Middleware para verificar que el usuario puede acceder a un recurso
 * (es el propietario o tiene permisos de admin)
 * @param {string} userIdParam - Nombre del parámetro que contiene el ID del usuario
 * @returns {Function} Middleware function
 */
const requireOwnershipOrAdmin = (userIdParam = 'userId') => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Autenticación requerida',
                code: 'AUTH_REQUIRED',
            });
        }

        const resourceUserId = parseInt(req.params[userIdParam]);
        const isOwner = req.user.id === resourceUserId;
        const isAdmin = ['superadministrador', 'administrador'].includes(req.user.roleName);

        if (!isOwner && !isAdmin) {
            return res.status(403).json({
                error: 'No tienes permisos para acceder a este recurso',
                code: 'INSUFFICIENT_PERMISSIONS',
            });
        }

        next();
    };
};

module.exports = {
    authenticate,
    optionalAuth,
    requireEmailVerification,
    requireOwnership,
    requireOwnershipOrAdmin,
};