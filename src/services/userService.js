const User = require('../models/User');
const Role = require('../models/Role');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

class UserService {
    /**
     * Obtiene todos los usuarios con filtros opcionales
     * @param {Object} filters - Filtros de búsqueda
     * @param {Object} pagination - Opciones de paginación
     * @returns {Object} Lista de usuarios paginada
     */
    async getUsers(filters = {}, pagination = {}) {
        try {
            const { page = 1, limit = 10, sortBy = 'created_at', sortOrder = 'DESC' } = pagination;
            const offset = (page - 1) * limit;

            // Construir filtros
            const where = {};

            if (filters.name) {
                where.name = { [Op.like]: `%${filters.name}%` };
            }

            if (filters.email) {
                where.email = { [Op.like]: `%${filters.email}%` };
            }

            if (filters.role_id) {
                where.role_id = filters.role_id;
            }

            if (filters.is_active !== undefined) {
                where.is_active = filters.is_active;
            }

            // Ejecutar consulta
            const { count, rows } = await User.findAndCountAll({
                where,
                include: [{
                    model: Role,
                    as: 'role',
                    attributes: ['id', 'name', 'description'],
                }],
                attributes: {
                    exclude: ['password', 'reset_password_token', 'verification_token', 'failed_login_attempts', 'locked_until']
                },
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [[sortBy, sortOrder.toUpperCase()]],
            });

            return {
                users: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(count / limit),
                },
            };
        } catch (error) {
            logger.error('Error in getUsers:', error);
            throw error;
        }
    }

    /**
     * Obtiene un usuario por ID
     * @param {number} userId - ID del usuario
     * @returns {Object} Usuario encontrado
     */
    async getUserById(userId) {
        try {
            const user = await User.findByPk(userId, {
                include: [{
                    model: Role,
                    as: 'role',
                    attributes: ['id', 'name', 'description'],
                }],
                attributes: {
                    exclude: ['password', 'reset_password_token', 'verification_token', 'failed_login_attempts', 'locked_until']
                },
            });

            if (!user) {
                throw new Error('Usuario no encontrado');
            }

            return { user };
        } catch (error) {
            logger.error('Error in getUserById:', error);
            throw error;
        }
    }

    /**
     * Crea un nuevo usuario
     * @param {Object} userData - Datos del usuario
     * @param {number} createdBy - ID del usuario que crea
     * @returns {Object} Usuario creado
     */
    async createUser(userData, createdBy) {
        try {
            const { name, email, password, role_id } = userData;

            // Verificar si el email ya existe
            const existingUser = await User.findByEmail(email);
            if (existingUser) {
                throw new Error('El email ya está registrado');
            }

            // Verificar si el rol existe
            const role = await Role.findByPk(role_id);
            if (!role) {
                throw new Error('El rol especificado no existe');
            }

            // Crear usuario
            const user = await User.create({
                name: name.trim(),
                email: email.toLowerCase().trim(),
                password,
                role_id,
                email_verified: true, // Los usuarios creados por admin están verificados
            });

            // Obtener usuario completo con rol
            const userWithRole = await User.findByPk(user.id, {
                include: [{
                    model: Role,
                    as: 'role',
                    attributes: ['id', 'name', 'description'],
                }],
            });

            // Registrar actividad
            await this.logActivity(createdBy, `Usuario creado: ${user.email}`);

            return {
                user: userWithRole.getPublicData(),
                message: 'Usuario creado exitosamente',
            };
        } catch (error) {
            logger.error('Error in createUser:', error);
            throw error;
        }
    }

    /**
     * Actualiza un usuario
     * @param {number} userId - ID del usuario
     * @param {Object} updateData - Datos a actualizar
     * @param {number} updatedBy - ID del usuario que actualiza
     * @returns {Object} Usuario actualizado
     */
    async updateUser(userId, updateData, updatedBy) {
        try {
            const user = await User.findByPk(userId);
            if (!user) {
                throw new Error('Usuario no encontrado');
            }

            // Campos permitidos para actualizar
            const allowedFields = ['name', 'email', 'role_id', 'is_active'];
            const filteredData = {};

            for (const field of allowedFields) {
                if (updateData[field] !== undefined) {
                    filteredData[field] = updateData[field];
                }
            }

            // Validar email único si se está actualizando
            if (filteredData.email && filteredData.email !== user.email) {
                const existingUser = await User.findByEmail(filteredData.email);
                if (existingUser) {
                    throw new Error('El email ya está registrado');
                }
                filteredData.email = filteredData.email.toLowerCase().trim();
            }

            // Validar rol si se está actualizando
            if (filteredData.role_id) {
                const role = await Role.findByPk(filteredData.role_id);
                if (!role) {
                    throw new Error('El rol especificado no existe');
                }
            }

            // Actualizar usuario
            await user.update(filteredData);

            // Obtener usuario actualizado con rol
            const updatedUser = await User.findByPk(userId, {
                include: [{
                    model: Role,
                    as: 'role',
                    attributes: ['id', 'name', 'description'],
                }],
            });

            // Registrar actividad
            await this.logActivity(updatedBy, `Usuario actualizado: ${user.email}`);

            return {
                user: updatedUser.getPublicData(),
                message: 'Usuario actualizado exitosamente',
            };
        } catch (error) {
            logger.error('Error in updateUser:', error);
            throw error;
        }
    }

    /**
     * Elimina un usuario (soft delete)
     * @param {number} userId - ID del usuario
     * @param {number} deletedBy - ID del usuario que elimina
     * @returns {Object} Mensaje de confirmación
     */
    async deleteUser(userId, deletedBy) {
        try {
            const user = await User.findByPk(userId);
            if (!user) {
                throw new Error('Usuario no encontrado');
            }

            // Verificar que no se esté eliminando a sí mismo
            if (userId === deletedBy) {
                throw new Error('No puedes eliminar tu propia cuenta');
            }

            // Desactivar usuario en lugar de eliminarlo
            await user.update({ is_active: false });

            // Registrar actividad
            await this.logActivity(deletedBy, `Usuario desactivado: ${user.email}`);

            return {
                message: 'Usuario desactivado exitosamente',
            };
        } catch (error) {
            logger.error('Error in deleteUser:', error);
            throw error;
        }
    }

    /**
     * Cambia el estado de un usuario
     * @param {number} userId - ID del usuario
     * @param {boolean} isActive - Nuevo estado
     * @param {number} changedBy - ID del usuario que cambia el estado
     * @returns {Object} Usuario actualizado
     */
    async changeUserStatus(userId, isActive, changedBy) {
        try {
            const user = await User.findByPk(userId);
            if (!user) {
                throw new Error('Usuario no encontrado');
            }

            // Verificar que no se esté desactivando a sí mismo
            if (userId === changedBy && !isActive) {
                throw new Error('No puedes desactivar tu propia cuenta');
            }

            // Actualizar estado
            await user.update({ is_active: isActive });

            // Obtener usuario actualizado con rol
            const updatedUser = await User.findByPk(userId, {
                include: [{
                    model: Role,
                    as: 'role',
                    attributes: ['id', 'name', 'description'],
                }],
            });

            // Registrar actividad
            const action = isActive ? 'activado' : 'desactivado';
            await this.logActivity(changedBy, `Usuario ${action}: ${user.email}`);

            return {
                user: updatedUser.getPublicData(),
                message: `Usuario ${action} exitosamente`,
            };
        } catch (error) {
            logger.error('Error in changeUserStatus:', error);
            throw error;
        }
    }

    /**
     * Cambia el rol de un usuario
     * @param {number} userId - ID del usuario
     * @param {number} newRoleId - ID del nuevo rol
     * @param {number} changedBy - ID del usuario que cambia el rol
     * @returns {Object} Usuario actualizado
     */
    async changeUserRole(userId, newRoleId, changedBy) {
        try {
            const user = await User.findByPk(userId);
            if (!user) {
                throw new Error('Usuario no encontrado');
            }

            // Verificar que el nuevo rol existe
            const newRole = await Role.findByPk(newRoleId);
            if (!newRole) {
                throw new Error('El rol especificado no existe');
            }

            // Actualizar rol
            await user.update({ role_id: newRoleId });

            // Obtener usuario actualizado con rol
            const updatedUser = await User.findByPk(userId, {
                include: [{
                    model: Role,
                    as: 'role',
                    attributes: ['id', 'name', 'description'],
                }],
            });

            // Registrar actividad
            await this.logActivity(changedBy, `Rol cambiado para usuario: ${user.email} -> ${newRole.name}`);

            return {
                user: updatedUser.getPublicData(),
                message: 'Rol actualizado exitosamente',
            };
        } catch (error) {
            logger.error('Error in changeUserRole:', error);
            throw error;
        }
    }

    /**
     * Obtiene estadísticas de usuarios
     * @returns {Object} Estadísticas
     */
    async getUserStats() {
        try {
            const totalUsers = await User.count();
            const activeUsers = await User.count({ where: { is_active: true } });
            const inactiveUsers = await User.count({ where: { is_active: false } });
            const verifiedUsers = await User.count({ where: { email_verified: true } });

            // Usuarios por rol
            const usersByRole = await User.findAll({
                attributes: ['role_id'],
                include: [{
                    model: Role,
                    as: 'role',
                    attributes: ['name'],
                }],
                group: ['role_id'],
                raw: true,
            });

            const roleStats = {};
            for (const roleData of usersByRole) {
                const roleName = roleData['role.name'];
                const count = await User.count({ where: { role_id: roleData.role_id } });
                roleStats[roleName] = count;
            }

            return {
                total: totalUsers,
                active: activeUsers,
                inactive: inactiveUsers,
                verified: verifiedUsers,
                byRole: roleStats,
            };
        } catch (error) {
            logger.error('Error in getUserStats:', error);
            throw error;
        }
    }

    /**
     * Busca usuarios por término
     * @param {string} searchTerm - Término de búsqueda
     * @param {Object} options - Opciones adicionales
     * @returns {Object} Usuarios encontrados
     */
    async searchUsers(searchTerm, options = {}) {
        try {
            const { limit = 10, activeOnly = true } = options;

            const where = {
                [Op.or]: [
                    { name: { [Op.like]: `%${searchTerm}%` } },
                    { email: { [Op.like]: `%${searchTerm}%` } },
                ],
            };

            if (activeOnly) {
                where.is_active = true;
            }

            const users = await User.findAll({
                where,
                include: [{
                    model: Role,
                    as: 'role',
                    attributes: ['id', 'name', 'description'],
                }],
                attributes: {
                    exclude: ['password', 'reset_password_token', 'verification_token', 'failed_login_attempts', 'locked_until']
                },
                limit: parseInt(limit),
                order: [['name', 'ASC']],
            });

            return { users };
        } catch (error) {
            logger.error('Error in searchUsers:', error);
            throw error;
        }
    }

    /**
     * Registra actividad del usuario
     * @param {number} userId - ID del usuario
     * @param {string} action - Acción realizada
     */
    async logActivity(userId, action) {
        try {
            const ActivityLog = require('../models/ActivityLog');
            await ActivityLog.create({
                user_id: userId,
                action,
            });
        } catch (error) {
            logger.error('Error logging activity:', error);
            // No lanzamos error para no interrumpir el flujo principal
        }
    }
}

module.exports = new UserService();