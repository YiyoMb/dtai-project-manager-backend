const express = require('express');
const router = express.Router();

// Importar controladores
const roleController = require('../controllers/roleController');

// Importar middlewares
const { authenticate } = require('../middleware/authMiddleware');
const {
    requireAdmin,
    requireSuperAdmin,
    requireMinimumRole
} = require('../middleware/roleMiddleware');
const {
    validate,
    paramSchemas
} = require('../middleware/validateMiddleware');
const Joi = require('joi');

// Esquemas de validación específicos para roles
const roleSchemas = {
    createRole: Joi.object({
        name: Joi.string()
            .min(2)
            .max(50)
            .lowercase()
            .trim()
            .required()
            .messages({
                'string.min': 'El nombre del rol debe tener al menos 2 caracteres',
                'string.max': 'El nombre del rol no debe exceder 50 caracteres',
                'any.required': 'El nombre del rol es requerido',
            }),
        description: Joi.string()
            .max(500)
            .optional()
            .messages({
                'string.max': 'La descripción no debe exceder 500 caracteres',
            }),
    }),

    updateRole: Joi.object({
        name: Joi.string()
            .min(2)
            .max(50)
            .lowercase()
            .trim()
            .optional()
            .messages({
                'string.min': 'El nombre del rol debe tener al menos 2 caracteres',
                'string.max': 'El nombre del rol no debe exceder 50 caracteres',
            }),
        description: Joi.string()
            .max(500)
            .optional()
            .allow('')
            .messages({
                'string.max': 'La descripción no debe exceder 500 caracteres',
            }),
    }),

    checkPermission: Joi.object({
        resource: Joi.string()
            .required()
            .messages({
                'any.required': 'El recurso es requerido',
            }),
        action: Joi.string()
            .required()
            .messages({
                'any.required': 'La acción es requerida',
            }),
    }),
};

/**
 * @route   GET /api/roles
 * @desc    Obtener todos los roles
 * @access  Private - Collaborator+
 */
router.get('/',
    authenticate,
    requireMinimumRole('colaborador'),
    roleController.getRoles
);

/**
 * @route   GET /api/roles/assignable
 * @desc    Obtener roles que el usuario actual puede asignar
 * @access  Private - Admin+
 */
router.get('/assignable',
    authenticate,
    requireAdmin,
    roleController.getAssignableRoles
);

/**
 * @route   GET /api/roles/stats
 * @desc    Obtener estadísticas de roles
 * @access  Private - Admin+
 */
router.get('/stats',
    authenticate,
    requireAdmin,
    roleController.getRoleStats
);

/**
 * @route   GET /api/roles/permissions
 * @desc    Obtener todos los permisos disponibles en el sistema
 * @access  Private - Admin+
 */
router.get('/permissions',
    authenticate,
    requireAdmin,
    roleController.getAvailablePermissions
);

/**
 * @route   POST /api/roles
 * @desc    Crear un nuevo rol
 * @access  Private - Superadmin only
 */
router.post('/',
    authenticate,
    requireSuperAdmin,
    validate(roleSchemas.createRole),
    roleController.createRole
);

/**
 * @route   GET /api/roles/:id
 * @desc    Obtener un rol por ID
 * @access  Private - Collaborator+
 */
router.get('/:id',
    authenticate,
    requireMinimumRole('colaborador'),
    validate(paramSchemas.id, 'params'),
    roleController.getRoleById
);

/**
 * @route   PUT /api/roles/:id
 * @desc    Actualizar un rol
 * @access  Private - Superadmin only
 */
router.put('/:id',
    authenticate,
    requireSuperAdmin,
    validate(paramSchemas.id, 'params'),
    validate(roleSchemas.updateRole),
    roleController.updateRole
);

/**
 * @route   DELETE /api/roles/:id
 * @desc    Eliminar un rol
 * @access  Private - Superadmin only
 */
router.delete('/:id',
    authenticate,
    requireSuperAdmin,
    validate(paramSchemas.id, 'params'),
    roleController.deleteRole
);

/**
 * @route   GET /api/roles/:id/permissions
 * @desc    Obtener permisos de un rol específico
 * @access  Private - Admin+
 */
router.get('/:id/permissions',
    authenticate,
    requireAdmin,
    validate(paramSchemas.id, 'params'),
    roleController.getRolePermissions
);

/**
 * @route   GET /api/roles/:id/check-permission
 * @desc    Verificar si un rol tiene un permiso específico
 * @access  Private - Admin+
 */
router.get('/:id/check-permission',
    authenticate,
    requireAdmin,
    validate(paramSchemas.id, 'params'),
    validate(roleSchemas.checkPermission, 'query'),
    roleController.checkRolePermission
);

module.exports = router;