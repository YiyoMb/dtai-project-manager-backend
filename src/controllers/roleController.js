const Role = require('../models/Role');
const logger = require('../utils/logger');

class RoleController {
    /**
     * Obtiene todos los roles
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async getRoles(req, res) {
        try {
            const roles = await Role.findAll({
                attributes: ['id', 'name', 'description'],
                order: [['name', 'ASC']],
            });

            logger.info('Roles retrieved successfully', {
                requestedBy: req.user.id,
                count: roles.length,
            });

            res.json({
                success: true,
                data: {
                    roles,
                },
            });
        } catch (error) {
            logger.error('Get roles error:', error);

            res.status(500).json({
                success: false,
                error: 'Error al obtener roles',
                code: 'GET_ROLES_ERROR',
            });
        }
    }

    /**
     * Obtiene un rol por ID
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async getRoleById(req, res) {
        try {
            const { id } = req.params;

            const role = await Role.findByPk(id, {
                attributes: ['id', 'name', 'description'],
            });

            if (!role) {
                return res.status(404).json({
                    success: false,
                    error: 'Rol no encontrado',
                    code: 'ROLE_NOT_FOUND',
                });
            }

            logger.info('Role retrieved successfully', {
                requestedBy: req.user.id,
                roleId: id,
            });

            res.json({
                success: true,
                data: {
                    role,
                },
            });
        } catch (error) {
            logger.error('Get role by ID error:', error);

            res.status(500).json({
                success: false,
                error: 'Error al obtener rol',
                code: 'GET_ROLE_ERROR',
            });
        }
    }

    /**
     * Crea un nuevo rol
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async createRole(req, res) {
        try {
            const { name, description } = req.body;

            // Verificar si el rol ya existe
            const existingRole = await Role.findOne({ where: { name } });
            if (existingRole) {
                return res.status(400).json({
                    success: false,
                    error: 'El rol ya existe',
                    code: 'ROLE_ALREADY_EXISTS',
                });
            }

            const role = await Role.create({
                name: name.toLowerCase(),
                description,
            });

            logger.info('Role created successfully', {
                createdBy: req.user.id,
                roleId: role.id,
                roleName: role.name,
            });

            res.status(201).json({
                success: true,
                message: 'Rol creado exitosamente',
                data: {
                    role: {
                        id: role.id,
                        name: role.name,
                        description: role.description,
                    },
                },
            });
        } catch (error) {
            logger.error('Create role error:', error);

            res.status(400).json({
                success: false,
                error: error.message,
                code: 'CREATE_ROLE_ERROR',
            });
        }
    }

    /**
     * Actualiza un rol existente
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async updateRole(req, res) {
        try {
            const { id } = req.params;
            const { name, description } = req.body;

            const role = await Role.findByPk(id);
            if (!role) {
                return res.status(404).json({
                    success: false,
                    error: 'Rol no encontrado',
                    code: 'ROLE_NOT_FOUND',
                });
            }

            // Verificar si el nuevo nombre ya existe (si se está cambiando)
            if (name && name !== role.name) {
                const existingRole = await Role.findOne({ where: { name } });
                if (existingRole) {
                    return res.status(400).json({
                        success: false,
                        error: 'El nombre del rol ya existe',
                        code: 'ROLE_NAME_EXISTS',
                    });
                }
            }

            // Actualizar solo los campos proporcionados
            const updateData = {};
            if (name) updateData.name = name.toLowerCase();
            if (description !== undefined) updateData.description = description;

            await role.update(updateData);

            logger.info('Role updated successfully', {
                updatedBy: req.user.id,
                roleId: id,
                updatedFields: Object.keys(updateData),
            });

            res.json({
                success: true,
                message: 'Rol actualizado exitosamente',
                data: {
                    role: {
                        id: role.id,
                        name: role.name,
                        description: role.description,
                    },
                },
            });
        } catch (error) {
            logger.error('Update role error:', error);

            res.status(400).json({
                success: false,
                error: error.message,
                code: 'UPDATE_ROLE_ERROR',
            });
        }
    }

    /**
     * Elimina un rol
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async deleteRole(req, res) {
        try {
            const { id } = req.params;

            const role = await Role.findByPk(id);
            if (!role) {
                return res.status(404).json({
                    success: false,
                    error: 'Rol no encontrado',
                    code: 'ROLE_NOT_FOUND',
                });
            }

            // Verificar si el rol está siendo usado por algún usuario
            const User = require('../models/User');
            const usersWithRole = await User.count({ where: { role_id: id } });

            if (usersWithRole > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No se puede eliminar el rol porque está siendo usado por usuarios',
                    code: 'ROLE_IN_USE',
                    usersCount: usersWithRole,
                });
            }

            // Verificar que no sea un rol del sistema
            const systemRoles = ['superadministrador', 'administrador', 'colaborador', 'cliente'];
            if (systemRoles.includes(role.name)) {
                return res.status(400).json({
                    success: false,
                    error: 'No se puede eliminar un rol del sistema',
                    code: 'SYSTEM_ROLE_CANNOT_DELETE',
                });
            }

            await role.destroy();

            logger.info('Role deleted successfully', {
                deletedBy: req.user.id,
                roleId: id,
                roleName: role.name,
            });

            res.json({
                success: true,
                message: 'Rol eliminado exitosamente',
            });
        } catch (error) {
            logger.error('Delete role error:', error);

            res.status(500).json({
                success: false,
                error: 'Error al eliminar rol',
                code: 'DELETE_ROLE_ERROR',
            });
        }
    }

    /**
     * Obtiene los permisos de un rol
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async getRolePermissions(req, res) {
        try {
            const { id } = req.params;

            const role = await Role.findByPk(id);
            if (!role) {
                return res.status(404).json({
                    success: false,
                    error: 'Rol no encontrado',
                    code: 'ROLE_NOT_FOUND',
                });
            }

            const permissions = Role.getPermissions(role.name);

            logger.info('Role permissions retrieved successfully', {
                requestedBy: req.user.id,
                roleId: id,
                roleName: role.name,
            });

            res.json({
                success: true,
                data: {
                    role: {
                        id: role.id,
                        name: role.name,
                        description: role.description,
                    },
                    permissions,
                },
            });
        } catch (error) {
            logger.error('Get role permissions error:', error);

            res.status(500).json({
                success: false,
                error: 'Error al obtener permisos del rol',
                code: 'GET_ROLE_PERMISSIONS_ERROR',
            });
        }
    }

    /**
     * Verifica si un rol tiene un permiso específico
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async checkRolePermission(req, res) {
        try {
            const { id } = req.params;
            const { resource, action } = req.query;

            if (!resource || !action) {
                return res.status(400).json({
                    success: false,
                    error: 'Recurso y acción son requeridos',
                    code: 'RESOURCE_ACTION_REQUIRED',
                });
            }

            const role = await Role.findByPk(id);
            if (!role) {
                return res.status(404).json({
                    success: false,
                    error: 'Rol no encontrado',
                    code: 'ROLE_NOT_FOUND',
                });
            }

            const hasPermission = Role.hasPermission(role.name, resource, action);

            logger.info('Role permission checked', {
                requestedBy: req.user.id,
                roleId: id,
                roleName: role.name,
                resource,
                action,
                hasPermission,
            });

            res.json({
                success: true,
                data: {
                    role: {
                        id: role.id,
                        name: role.name,
                    },
                    resource,
                    action,
                    hasPermission,
                },
            });
        } catch (error) {
            logger.error('Check role permission error:', error);

            res.status(500).json({
                success: false,
                error: 'Error al verificar permiso del rol',
                code: 'CHECK_ROLE_PERMISSION_ERROR',
            });
        }
    }

    /**
     * Obtiene todos los permisos disponibles en el sistema
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async getAvailablePermissions(req, res) {
        try {
            const permissions = {
                users: ['create', 'read', 'update', 'delete'],
                roles: ['create', 'read', 'update', 'delete'],
                portfolios: ['create', 'read', 'update', 'delete'],
                programs: ['create', 'read', 'update', 'delete'],
                projects: ['create', 'read', 'update', 'delete'],
                documents: ['create', 'read', 'update', 'delete', 'approve', 'sign'],
                tasks: ['create', 'read', 'update', 'delete', 'assign'],
                meetings: ['create', 'read', 'update', 'delete'],
                notifications: ['create', 'read', 'update', 'delete'],
                dashboard: ['read'],
                system: ['configure'],
            };

            logger.info('Available permissions retrieved successfully', {
                requestedBy: req.user.id,
            });

            res.json({
                success: true,
                data: {
                    permissions,
                },
            });
        } catch (error) {
            logger.error('Get available permissions error:', error);

            res.status(500).json({
                success: false,
                error: 'Error al obtener permisos disponibles',
                code: 'GET_AVAILABLE_PERMISSIONS_ERROR',
            });
        }
    }

    /**
     * Obtiene estadísticas de roles
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async getRoleStats(req, res) {
        try {
            const User = require('../models/User');

            const roles = await Role.findAll({
                attributes: ['id', 'name', 'description'],
            });

            const roleStats = await Promise.all(
                roles.map(async (role) => {
                    const userCount = await User.count({ where: { role_id: role.id } });
                    const activeUserCount = await User.count({
                        where: {
                            role_id: role.id,
                            is_active: true
                        }
                    });

                    return {
                        id: role.id,
                        name: role.name,
                        description: role.description,
                        userCount,
                        activeUserCount,
                        permissions: Role.getPermissions(role.name),
                    };
                })
            );

            logger.info('Role stats retrieved successfully', {
                requestedBy: req.user.id,
                rolesCount: roles.length,
            });

            res.json({
                success: true,
                data: {
                    roles: roleStats,
                    totalRoles: roles.length,
                },
            });
        } catch (error) {
            logger.error('Get role stats error:', error);

            res.status(500).json({
                success: false,
                error: 'Error al obtener estadísticas de roles',
                code: 'GET_ROLE_STATS_ERROR',
            });
        }
    }

    /**
     * Obtiene roles disponibles para asignación
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async getAssignableRoles(req, res) {
        try {
            const currentUserRole = req.user.roleName;

            // Definir qué roles puede asignar cada tipo de usuario
            let assignableRoles = [];

            if (currentUserRole === 'superadministrador') {
                assignableRoles = ['superadministrador', 'administrador', 'colaborador', 'cliente'];
            } else if (currentUserRole === 'administrador') {
                assignableRoles = ['colaborador', 'cliente'];
            }

            const roles = await Role.findAll({
                where: {
                    name: assignableRoles,
                },
                attributes: ['id', 'name', 'description'],
                order: [['name', 'ASC']],
            });

            logger.info('Assignable roles retrieved successfully', {
                requestedBy: req.user.id,
                currentUserRole,
                assignableRolesCount: roles.length,
            });

            res.json({
                success: true,
                data: {
                    roles,
                    currentUserRole,
                },
            });
        } catch (error) {
            logger.error('Get assignable roles error:', error);

            res.status(500).json({
                success: false,
                error: 'Error al obtener roles asignables',
                code: 'GET_ASSIGNABLE_ROLES_ERROR',
            });
        }
    }
}

module.exports = new RoleController();