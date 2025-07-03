const Role = require('../models/Role');
const logger = require('../utils/logger');

/**
 * Middleware para verificar roles específicos
 * @param {string|Array} allowedRoles - Roles permitidos
 * @returns {Function} Middleware function
 */
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Autenticación requerida',
                code: 'AUTH_REQUIRED',
            });
        }

        const userRole = req.user.roleName;
        const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

        if (!rolesArray.includes(userRole)) {
            logger.warn(`Access denied for user ${req.user.id} with role ${userRole}. Required roles: ${rolesArray.join(', ')}`);

            return res.status(403).json({
                error: 'No tienes permisos para acceder a este recurso',
                code: 'INSUFFICIENT_PERMISSIONS',
                requiredRoles: rolesArray,
                currentRole: userRole,
            });
        }

        next();
    };
};

/**
 * Middleware para verificar permisos específicos
 * @param {string} resource - Recurso a verificar
 * @param {string} action - Acción a verificar
 * @returns {Function} Middleware function
 */
const requirePermission = (resource, action) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Autenticación requerida',
                code: 'AUTH_REQUIRED',
            });
        }

        const userRole = req.user.roleName;
        const hasPermission = Role.hasPermission(userRole, resource, action);

        if (!hasPermission) {
            logger.warn(`Permission denied for user ${req.user.id} with role ${userRole}. Required: ${resource}:${action}`);

            return res.status(403).json({
                error: 'No tienes permisos para realizar esta acción',
                code: 'INSUFFICIENT_PERMISSIONS',
                requiredPermission: `${resource}:${action}`,
                currentRole: userRole,
            });
        }

        next();
    };
};

/**
 * Middleware para verificar si es superadministrador
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 */
const requireSuperAdmin = (req, res, next) => {
    return requireRole('superadministrador')(req, res, next);
};

/**
 * Middleware para verificar si es administrador o superadministrador
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 */
const requireAdmin = (req, res, next) => {
    return requireRole(['superadministrador', 'administrador'])(req, res, next);
};

/**
 * Middleware para verificar si es colaborador o superior
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 */
const requireCollaborator = (req, res, next) => {
    return requireRole(['superadministrador', 'administrador', 'colaborador'])(req, res, next);
};

/**
 * Middleware para verificar jerarquía de roles
 * Permite acceso si el usuario tiene un rol igual o superior al requerido
 * @param {string} minimumRole - Rol mínimo requerido
 * @returns {Function} Middleware function
 */
const requireMinimumRole = (minimumRole) => {
    const roleHierarchy = {
        'cliente': 1,
        'colaborador': 2,
        'administrador': 3,
        'superadministrador': 4,
    };

    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Autenticación requerida',
                code: 'AUTH_REQUIRED',
            });
        }

        const userRole = req.user.roleName;
        const userRoleLevel = roleHierarchy[userRole] || 0;
        const requiredRoleLevel = roleHierarchy[minimumRole] || 0;

        if (userRoleLevel < requiredRoleLevel) {
            logger.warn(`Insufficient role level for user ${req.user.id}. Required: ${minimumRole} (${requiredRoleLevel}), Current: ${userRole} (${userRoleLevel})`);

            return res.status(403).json({
                error: 'No tienes el nivel de permisos requerido',
                code: 'INSUFFICIENT_ROLE_LEVEL',
                requiredRole: minimumRole,
                currentRole: userRole,
            });
        }

        next();
    };
};

/**
 * Middleware para verificar múltiples condiciones de roles
 * @param {Object} conditions - Condiciones a verificar
 * @returns {Function} Middleware function
 */
const requireRoleConditions = (conditions) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Autenticación requerida',
                code: 'AUTH_REQUIRED',
            });
        }

        const userRole = req.user.roleName;
        let hasAccess = false;

        // Verificar si el usuario tiene uno de los roles permitidos
        if (conditions.roles && conditions.roles.includes(userRole)) {
            hasAccess = true;
        }

        // Verificar si el usuario tiene los permisos específicos
        if (conditions.permissions && !hasAccess) {
            for (const permission of conditions.permissions) {
                const [resource, action] = permission.split(':');
                if (Role.hasPermission(userRole, resource, action)) {
                    hasAccess = true;
                    break;
                }
            }
        }

        // Verificar si el usuario es propietario del recurso
        if (conditions.ownership && !hasAccess) {
            const resourceUserId = parseInt(req.params[conditions.ownership.param]);
            if (req.user.id === resourceUserId) {
                hasAccess = true;
            }
        }

        if (!hasAccess) {
            logger.warn(`Access denied for user ${req.user.id} with role ${userRole}. Conditions: ${JSON.stringify(conditions)}`);

            return res.status(403).json({
                error: 'No cumples con las condiciones de acceso requeridas',
                code: 'ACCESS_CONDITIONS_NOT_MET',
                currentRole: userRole,
            });
        }

        next();
    };
};

/**
 * Middleware para verificar que el usuario puede gestionar otro usuario
 * (no puede gestionar usuarios con roles superiores)
 * @param {string} targetUserIdParam - Parámetro que contiene el ID del usuario objetivo
 * @returns {Function} Middleware function
 */
const canManageUser = (targetUserIdParam = 'userId') => {
    const roleHierarchy = {
        'cliente': 1,
        'colaborador': 2,
        'administrador': 3,
        'superadministrador': 4,
    };

    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    error: 'Autenticación requerida',
                    code: 'AUTH_REQUIRED',
                });
            }

            const targetUserId = parseInt(req.params[targetUserIdParam]);

            // Superadministrador puede gestionar cualquier usuario
            if (req.user.roleName === 'superadministrador') {
                return next();
            }

            // Buscar el usuario objetivo para verificar su rol
            const User = require('../models/User');
            const targetUser = await User.findByPk(targetUserId, {
                include: [{
                    model: Role,
                    as: 'role',
                    attributes: ['name'],
                }],
            });

            if (!targetUser) {
                return res.status(404).json({
                    error: 'Usuario no encontrado',
                    code: 'USER_NOT_FOUND',
                });
            }

            const currentUserLevel = roleHierarchy[req.user.roleName] || 0;
            const targetUserLevel = roleHierarchy[targetUser.role.name] || 0;

            // No puede gestionar usuarios con roles superiores o iguales
            if (targetUserLevel >= currentUserLevel) {
                return res.status(403).json({
                    error: 'No puedes gestionar usuarios con roles superiores o iguales al tuyo',
                    code: 'CANNOT_MANAGE_SUPERIOR_ROLE',
                    currentRole: req.user.roleName,
                    targetRole: targetUser.role.name,
                });
            }

            next();
        } catch (error) {
            logger.error('Error in canManageUser middleware:', error);
            return res.status(500).json({
                error: 'Error interno del servidor',
                code: 'INTERNAL_SERVER_ERROR',
            });
        }
    };
};

module.exports = {
    requireRole,
    requirePermission,
    requireSuperAdmin,
    requireAdmin,
    requireCollaborator,
    requireMinimumRole,
    requireRoleConditions,
    canManageUser,
};