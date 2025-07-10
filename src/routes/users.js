const express = require('express');
const router = express.Router();

// Importar controladores
const userController = require('../controllers/userController');

// Importar middlewares
const { authenticate } = require('../middleware/authMiddleware');
const {
    requireAdmin,
    requireSuperAdmin,
    canManageUser,
    requireMinimumRole
} = require('../middleware/roleMiddleware');
const {
    validate,
    userSchemas,
    paramSchemas,
    querySchemas
} = require('../middleware/validateMiddleware');

/**
 * @route   GET /api/users
 * @desc    Obtener todos los usuarios con filtros y paginación
 * @access  Private - Admin+
 */
router.get('/',
    authenticate,
    requireAdmin,
    validate(querySchemas.pagination, 'query'),
    validate(querySchemas.userFilters, 'query'),
    userController.getUsers
);

/**
 * @route   GET /api/users/search
 * @desc    Buscar usuarios por término
 * @access  Private - Admin+
 */
router.get('/search',
    authenticate,
    requireAdmin,
    userController.searchUsers
);

/**
 * @route   GET /api/users/stats
 * @desc    Obtener estadísticas de usuarios
 * @access  Private - Admin+
 */
router.get('/stats',
    authenticate,
    requireAdmin,
    userController.getUserStats
);

/**
 * @route   GET /api/users/recent-active
 * @desc    Obtener usuarios activos recientes
 * @access  Private - Admin+
 */
router.get('/recent-active',
    authenticate,
    requireAdmin,
    userController.getRecentActiveUsers
);

/**
 * @route   GET /api/users/by-role/:roleId
 * @desc    Obtener usuarios por rol
 * @access  Private - Admin+
 */
router.get('/by-role/:roleId',
    authenticate,
    requireAdmin,
    validate(paramSchemas.id, 'params'),
    userController.getUsersByRole
);

/**
 * @route   POST /api/users
 * @desc    Crear un nuevo usuario
 * @access  Private - Admin+
 */
router.post('/',
    authenticate,
    requireAdmin,
    validate(userSchemas.createUser),
    userController.createUser
);

/**
 * @route   GET /api/users/:id
 * @desc    Obtener un usuario por ID
 * @access  Private - Admin+ or Own Profile
 */
router.get('/:id',
    authenticate,
    requireMinimumRole('colaborador'),
    validate(paramSchemas.id, 'params'),
    userController.getUserById
);

/**
 * @route   PUT /api/users/:id
 * @desc    Actualizar un usuario
 * @access  Private - Admin+ (with role hierarchy restrictions)
 */
router.put('/:id',
    authenticate,
    requireAdmin,
    validate(paramSchemas.id, 'params'),
    validate(userSchemas.updateUser),
    canManageUser('id'),
    userController.updateUser
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Eliminar un usuario (desactivar)
 * @access  Private - Admin+ (with role hierarchy restrictions)
 */
router.delete('/:id',
    authenticate,
    requireAdmin,
    validate(paramSchemas.id, 'params'),
    canManageUser('id'),
    userController.deleteUser
);

/**
 * @route   PUT /api/users/:id/status
 * @desc    Cambiar el estado de un usuario
 * @access  Private - Admin+ (with role hierarchy restrictions)
 */
router.put('/:id/status',
    authenticate,
    requireAdmin,
    validate(paramSchemas.id, 'params'),
    validate(userSchemas.changeUserStatus),
    canManageUser('id'),
    userController.changeUserStatus
);

/**
 * @route   PUT /api/users/:id/role
 * @desc    Cambiar el rol de un usuario
 * @access  Private - Superadmin or Admin (with restrictions)
 */
router.put('/:id/role',
    authenticate,
    requireAdmin,
    validate(paramSchemas.id, 'params'),
    validate(userSchemas.changeUserRole),
    canManageUser('id'),
    userController.changeUserRole
);

/**
 * @route   GET /api/users/:id/profile
 * @desc    Obtener perfil detallado de un usuario
 * @access  Private - Admin+ or Own Profile
 */
router.get('/:id/profile',
    authenticate,
    requireMinimumRole('colaborador'),
    validate(paramSchemas.id, 'params'),
    userController.getUserProfile
);

module.exports = router;