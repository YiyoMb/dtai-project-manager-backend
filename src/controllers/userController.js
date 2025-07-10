const userService = require('../services/userService');
const logger = require('../utils/logger');

class UserController {
    /**
     * Obtiene todos los usuarios con filtros y paginación
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async getUsers(req, res) {
        try {
            const filters = {
                name: req.query.name,
                email: req.query.email,
                role_id: req.query.role_id,
                is_active: req.query.is_active,
            };

            const pagination = {
                page: req.query.page,
                limit: req.query.limit,
                sortBy: req.query.sortBy,
                sortOrder: req.query.sortOrder,
            };

            const result = await userService.getUsers(filters, pagination);

            logger.info('Users retrieved successfully', {
                requestedBy: req.user.id,
                count: result.users.length,
                page: pagination.page,
            });

            res.json({
                success: true,
                data: {
                    users: result.users,
                    pagination: result.pagination,
                },
            });
        } catch (error) {
            logger.error('Get users error:', error);

            res.status(500).json({
                success: false,
                error: 'Error al obtener usuarios',
                code: 'GET_USERS_ERROR',
            });
        }
    }

    /**
     * Obtiene un usuario por ID
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async getUserById(req, res) {
        try {
            const { id } = req.params;

            const result = await userService.getUserById(id);

            logger.info('User retrieved successfully', {
                requestedBy: req.user.id,
                targetUserId: id,
            });

            res.json({
                success: true,
                data: {
                    user: result.user,
                },
            });
        } catch (error) {
            logger.error('Get user by ID error:', error);

            const statusCode = error.message === 'Usuario no encontrado' ? 404 : 500;

            res.status(statusCode).json({
                success: false,
                error: error.message,
                code: 'GET_USER_ERROR',
            });
        }
    }

    /**
     * Crea un nuevo usuario
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async createUser(req, res) {
        try {
            const userData = req.body;
            const createdBy = req.user.id;

            const result = await userService.createUser(userData, createdBy);

            logger.info('User created successfully', {
                createdBy,
                newUserId: result.user.id,
                email: result.user.email,
            });

            res.status(201).json({
                success: true,
                message: result.message,
                data: {
                    user: result.user,
                },
            });
        } catch (error) {
            logger.error('Create user error:', error);

            res.status(400).json({
                success: false,
                error: error.message,
                code: 'CREATE_USER_ERROR',
            });
        }
    }

    /**
     * Actualiza un usuario existente
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async updateUser(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            const updatedBy = req.user.id;

            const result = await userService.updateUser(id, updateData, updatedBy);

            logger.info('User updated successfully', {
                updatedBy,
                targetUserId: id,
                updatedFields: Object.keys(updateData),
            });

            res.json({
                success: true,
                message: result.message,
                data: {
                    user: result.user,
                },
            });
        } catch (error) {
            logger.error('Update user error:', error);

            const statusCode = error.message === 'Usuario no encontrado' ? 404 : 400;

            res.status(statusCode).json({
                success: false,
                error: error.message,
                code: 'UPDATE_USER_ERROR',
            });
        }
    }

    /**
     * Elimina un usuario (desactivación)
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async deleteUser(req, res) {
        try {
            const { id } = req.params;
            const deletedBy = req.user.id;

            const result = await userService.deleteUser(id, deletedBy);

            logger.info('User deleted successfully', {
                deletedBy,
                targetUserId: id,
            });

            res.json({
                success: true,
                message: result.message,
            });
        } catch (error) {
            logger.error('Delete user error:', error);

            const statusCode = error.message === 'Usuario no encontrado' ? 404 : 400;

            res.status(statusCode).json({
                success: false,
                error: error.message,
                code: 'DELETE_USER_ERROR',
            });
        }
    }

    /**
     * Cambia el estado de un usuario
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async changeUserStatus(req, res) {
        try {
            const { id } = req.params;
            const { is_active } = req.body;
            const changedBy = req.user.id;

            const result = await userService.changeUserStatus(id, is_active, changedBy);

            logger.info('User status changed successfully', {
                changedBy,
                targetUserId: id,
                newStatus: is_active,
            });

            res.json({
                success: true,
                message: result.message,
                data: {
                    user: result.user,
                },
            });
        } catch (error) {
            logger.error('Change user status error:', error);

            const statusCode = error.message === 'Usuario no encontrado' ? 404 : 400;

            res.status(statusCode).json({
                success: false,
                error: error.message,
                code: 'CHANGE_USER_STATUS_ERROR',
            });
        }
    }

    /**
     * Cambia el rol de un usuario
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async changeUserRole(req, res) {
        try {
            const { id } = req.params;
            const { role_id } = req.body;
            const changedBy = req.user.id;

            const result = await userService.changeUserRole(id, role_id, changedBy);

            logger.info('User role changed successfully', {
                changedBy,
                targetUserId: id,
                newRoleId: role_id,
            });

            res.json({
                success: true,
                message: result.message,
                data: {
                    user: result.user,
                },
            });
        } catch (error) {
            logger.error('Change user role error:', error);

            const statusCode = error.message === 'Usuario no encontrado' ? 404 : 400;

            res.status(statusCode).json({
                success: false,
                error: error.message,
                code: 'CHANGE_USER_ROLE_ERROR',
            });
        }
    }

    /**
     * Obtiene estadísticas de usuarios
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async getUserStats(req, res) {
        try {
            const stats = await userService.getUserStats();

            logger.info('User stats retrieved successfully', {
                requestedBy: req.user.id,
            });

            res.json({
                success: true,
                data: {
                    stats,
                },
            });
        } catch (error) {
            logger.error('Get user stats error:', error);

            res.status(500).json({
                success: false,
                error: 'Error al obtener estadísticas',
                code: 'GET_USER_STATS_ERROR',
            });
        }
    }

    /**
     * Busca usuarios por término
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async searchUsers(req, res) {
        try {
            const { q: searchTerm } = req.query;
            const options = {
                limit: req.query.limit || 10,
                activeOnly: req.query.activeOnly !== 'false',
            };

            if (!searchTerm) {
                return res.status(400).json({
                    success: false,
                    error: 'Término de búsqueda requerido',
                    code: 'SEARCH_TERM_REQUIRED',
                });
            }

            const result = await userService.searchUsers(searchTerm, options);

            logger.info('Users search completed', {
                requestedBy: req.user.id,
                searchTerm,
                resultsCount: result.users.length,
            });

            res.json({
                success: true,
                data: {
                    users: result.users,
                    searchTerm,
                },
            });
        } catch (error) {
            logger.error('Search users error:', error);

            res.status(500).json({
                success: false,
                error: 'Error al buscar usuarios',
                code: 'SEARCH_USERS_ERROR',
            });
        }
    }

    /**
     * Obtiene usuarios por rol
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async getUsersByRole(req, res) {
        try {
            const { roleId } = req.params;

            const filters = { role_id: roleId, is_active: true };
            const pagination = { page: 1, limit: 100 };

            const result = await userService.getUsers(filters, pagination);

            logger.info('Users by role retrieved successfully', {
                requestedBy: req.user.id,
                roleId,
                count: result.users.length,
            });

            res.json({
                success: true,
                data: {
                    users: result.users,
                    roleId: parseInt(roleId),
                },
            });
        } catch (error) {
            logger.error('Get users by role error:', error);

            res.status(500).json({
                success: false,
                error: 'Error al obtener usuarios por rol',
                code: 'GET_USERS_BY_ROLE_ERROR',
            });
        }
    }

    /**
     * Obtiene el perfil de otro usuario (para administradores)
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async getUserProfile(req, res) {
        try {
            const { id } = req.params;

            const result = await userService.getUserById(id);

            logger.info('User profile retrieved successfully', {
                requestedBy: req.user.id,
                targetUserId: id,
            });

            res.json({
                success: true,
                data: {
                    user: result.user,
                },
            });
        } catch (error) {
            logger.error('Get user profile error:', error);

            const statusCode = error.message === 'Usuario no encontrado' ? 404 : 500;

            res.status(statusCode).json({
                success: false,
                error: error.message,
                code: 'GET_USER_PROFILE_ERROR',
            });
        }
    }

    /**
     * Obtiene usuarios activos recientes
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async getRecentActiveUsers(req, res) {
        try {
            const filters = { is_active: true };
            const pagination = {
                page: 1,
                limit: req.query.limit || 10,
                sortBy: 'last_login',
                sortOrder: 'DESC'
            };

            const result = await userService.getUsers(filters, pagination);

            logger.info('Recent active users retrieved successfully', {
                requestedBy: req.user.id,
                count: result.users.length,
            });

            res.json({
                success: true,
                data: {
                    users: result.users,
                    pagination: result.pagination,
                },
            });
        } catch (error) {
            logger.error('Get recent active users error:', error);

            res.status(500).json({
                success: false,
                error: 'Error al obtener usuarios activos recientes',
                code: 'GET_RECENT_ACTIVE_USERS_ERROR',
            });
        }
    }
}

module.exports = new UserController();