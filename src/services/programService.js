const Program = require('../models/Program');
const Portfolio = require('../models/Portfolio');
const User = require('../models/User');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

class ProgramService {
    /**
     * Crear un nuevo programa
     * @param {Object} programData - Datos del programa
     * @param {number} userId - ID del usuario creador
     * @returns {Promise<Object>} Programa creado
     */
    async createProgram(programData, userId) {
        try {
            logger.info(`Iniciando creación de programa por usuario ${userId}`, {
                programName: programData.name,
                portfolioId: programData.portfolio_id,
                userId
            });

            // Verificar que el usuario existe y está activo
            const user = await User.findByPk(userId);
            if (!user || !user.is_active) {
                throw new Error('Usuario no válido o inactivo');
            }

            // Verificar que el portfolio existe
            const portfolio = await Portfolio.findByPk(programData.portfolio_id);
            if (!portfolio) {
                throw new Error('Portfolio no encontrado');
            }

            // Verificar permisos sobre el portfolio
            const userWithRole = await User.findByPk(userId, { include: ['role'] });
            const canCreateInPortfolio = portfolio.created_by === userId ||
                userWithRole.role.name === 'superadministrador' ||
                userWithRole.role.name === 'administrador';

            if (!canCreateInPortfolio) {
                throw new Error('No tienes permisos para crear programas en este portfolio');
            }

            // Verificar que no existe un programa con el mismo nombre en el portfolio
            const existingProgram = await Program.findOne({
                where: {
                    name: programData.name,
                    portfolio_id: programData.portfolio_id
                }
            });

            if (existingProgram) {
                throw new Error('Ya existe un programa con este nombre en el portfolio');
            }

            // Crear el programa
            const program = await Program.create({
                portfolio_id: programData.portfolio_id,
                name: programData.name.trim(),
                description: programData.description?.trim() || null,
                status: programData.status || 'activo',
                created_by: userId
            });

            logger.info(`Programa creado exitosamente con ID ${program.id}`, {
                programId: program.id,
                programName: program.name,
                portfolioId: program.portfolio_id,
                userId
            });

            // Devolver el programa con información relacionada
            return await this.getProgramById(program.id, userId);

        } catch (error) {
            logger.error('Error al crear programa', {
                error: error.message,
                programData,
                userId
            });
            throw error;
        }
    }

    /**
     * Obtener programa por ID
     * @param {number} programId - ID del programa
     * @param {number} userId - ID del usuario que consulta
     * @returns {Promise<Object>} Programa con datos relacionados
     */
    async getProgramById(programId, userId) {
        try {
            const program = await Program.findWithProjects(programId);

            if (!program) {
                throw new Error('Programa no encontrado');
            }

            // Verificar permisos de acceso
            const user = await User.findByPk(userId, { include: ['role'] });
            const canView = program.portfolio.created_by === userId ||
                program.created_by === userId ||
                user.role.name === 'superadministrador' ||
                user.role.name === 'administrador';

            if (!canView) {
                // Devolver versión limitada para colaboradores
                return {
                    id: program.id,
                    name: program.name,
                    description: program.description,
                    status: program.status,
                    created_at: program.created_at,
                    portfolio: {
                        id: program.portfolio.id,
                        name: program.portfolio.name
                    },
                    projects_count: program.projects?.length || 0
                };
            }

            return program;

        } catch (error) {
            logger.error('Error al obtener programa', {
                error: error.message,
                programId,
                userId
            });
            throw error;
        }
    }

    /**
     * Obtener programas de un portfolio
     * @param {number} portfolioId - ID del portfolio
     * @param {number} userId - ID del usuario
     * @param {Object} options - Opciones de consulta
     * @returns {Promise<Object>} Lista de programas con paginación
     */
    async getProgramsByPortfolio(portfolioId, userId, options = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                search = '',
                status = '',
                include_projects = false
            } = options;

            const offset = (page - 1) * limit;

            // Verificar que el portfolio existe y el usuario tiene acceso
            const portfolio = await Portfolio.findByPk(portfolioId);
            if (!portfolio) {
                throw new Error('Portfolio no encontrado');
            }

            const user = await User.findByPk(userId, { include: ['role'] });
            const canView = portfolio.created_by === userId ||
                user.role.name === 'superadministrador' ||
                user.role.name === 'administrador';

            if (!canView) {
                throw new Error('No tienes permisos para ver los programas de este portfolio');
            }

            // Construir condiciones de búsqueda
            const whereClause = {
                portfolio_id: portfolioId
            };

            if (search.trim()) {
                whereClause[Op.or] = [
                    { name: { [Op.like]: `%${search.trim()}%` } },
                    { description: { [Op.like]: `%${search.trim()}%` } }
                ];
            }

            if (status && ['activo', 'pausado', 'completado', 'cancelado'].includes(status)) {
                whereClause.status = status;
            }

            // Configurar includes
            const includeOptions = [
                {
                    association: 'creator',
                    attributes: ['id', 'name', 'email']
                },
                {
                    association: 'portfolio',
                    attributes: ['id', 'name']
                }
            ];

            if (include_projects) {
                includeOptions.push({
                    association: 'projects',
                    required: false,
                    attributes: ['id', 'name', 'status', 'risk_level']
                });
            }

            const { count, rows } = await Program.findAndCountAll({
                where: whereClause,
                include: includeOptions,
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['created_at', 'DESC']],
                distinct: true
            });

            return {
                programs: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(count / limit)
                }
            };

        } catch (error) {
            logger.error('Error al obtener programas del portfolio', {
                error: error.message,
                portfolioId,
                userId,
                options
            });
            throw error;
        }
    }

    /**
     * Actualizar programa
     * @param {number} programId - ID del programa
     * @param {Object} updateData - Datos a actualizar
     * @param {number} userId - ID del usuario que actualiza
     * @returns {Promise<Object>} Programa actualizado
     */
    async updateProgram(programId, updateData, userId) {
        try {
            const program = await Program.findByPk(programId, {
                include: [
                    {
                        association: 'portfolio',
                        attributes: ['id', 'name', 'created_by']
                    }
                ]
            });

            if (!program) {
                throw new Error('Programa no encontrado');
            }

            // Verificar permisos de edición
            const user = await User.findByPk(userId, { include: ['role'] });
            const canEdit = program.portfolio.created_by === userId ||
                program.created_by === userId ||
                user.role.name === 'superadministrador' ||
                user.role.name === 'administrador';

            if (!canEdit) {
                throw new Error('No tienes permisos para editar este programa');
            }

            // Verificar nombre único si se está cambiando
            if (updateData.name && updateData.name !== program.name) {
                const existingProgram = await Program.findOne({
                    where: {
                        name: updateData.name,
                        portfolio_id: program.portfolio_id,
                        id: { [Op.ne]: programId }
                    }
                });

                if (existingProgram) {
                    throw new Error('Ya existe un programa con este nombre en el portfolio');
                }
            }

            // Actualizar campos permitidos
            const allowedFields = ['name', 'description', 'status'];
            const updateFields = {};

            allowedFields.forEach(field => {
                if (updateData[field] !== undefined) {
                    updateFields[field] = typeof updateData[field] === 'string'
                        ? updateData[field].trim()
                        : updateData[field];
                }
            });

            await program.update(updateFields);

            logger.info(`Programa ${programId} actualizado por usuario ${userId}`, {
                programId,
                userId,
                updatedFields: Object.keys(updateFields)
            });

            return await this.getProgramById(programId, userId);

        } catch (error) {
            logger.error('Error al actualizar programa', {
                error: error.message,
                programId,
                updateData,
                userId
            });
            throw error;
        }
    }

    /**
     * Eliminar programa
     * @param {number} programId - ID del programa
     * @param {number} userId - ID del usuario que elimina
     * @returns {Promise<boolean>} Resultado de la eliminación
     */
    async deleteProgram(programId, userId) {
        try {
            const program = await Program.findByPk(programId, {
                include: [
                    {
                        association: 'portfolio',
                        attributes: ['id', 'name', 'created_by']
                    },
                    {
                        association: 'projects'
                    }
                ]
            });

            if (!program) {
                throw new Error('Programa no encontrado');
            }

            // Verificar permisos de eliminación (más restrictivo)
            const user = await User.findByPk(userId, { include: ['role'] });
            const canDelete = program.portfolio.created_by === userId ||
                user.role.name === 'superadministrador';

            if (!canDelete) {
                throw new Error('No tienes permisos para eliminar este programa');
            }

            // Verificar que no tenga proyectos asociados
            if (program.projects && program.projects.length > 0) {
                throw new Error('No se puede eliminar un programa que contiene proyectos');
            }

            await program.destroy();

            logger.info(`Programa ${programId} eliminado por usuario ${userId}`, {
                programId,
                programName: program.name,
                portfolioId: program.portfolio_id,
                userId
            });

            return true;

        } catch (error) {
            logger.error('Error al eliminar programa', {
                error: error.message,
                programId,
                userId
            });
            throw error;
        }
    }

    /**
     * Obtener estadísticas del programa
     * @param {number} programId - ID del programa
     * @param {number} userId - ID del usuario que consulta
     * @returns {Promise<Object>} Estadísticas del programa
     */
    async getProgramStats(programId, userId) {
        try {
            const program = await Program.findByPk(programId, {
                include: [
                    {
                        association: 'portfolio',
                        attributes: ['id', 'name', 'created_by']
                    },
                    {
                        association: 'projects',
                        attributes: ['id', 'name', 'status', 'risk_level']
                    }
                ]
            });

            if (!program) {
                throw new Error('Programa no encontrado');
            }

            // Verificar permisos
            const user = await User.findByPk(userId, { include: ['role'] });
            const canView = program.portfolio.created_by === userId ||
                program.created_by === userId ||
                user.role.name === 'superadministrador' ||
                user.role.name === 'administrador';

            if (!canView) {
                throw new Error('No tienes permisos para ver estadísticas de este programa');
            }

            // Calcular estadísticas
            const stats = {
                program_id: programId,
                program_name: program.name,
                program_status: program.status,
                portfolio: {
                    id: program.portfolio.id,
                    name: program.portfolio.name
                },
                projects_count: program.projects?.length || 0,
                projects_by_status: {
                    pendiente: 0,
                    en_proceso: 0,
                    finalizado: 0
                },
                projects_by_risk: {
                    bajo: 0,
                    medio: 0,
                    alto: 0,
                    critico: 0
                }
            };

            // Procesar proyectos
            program.projects?.forEach(project => {
                // Contar por estado
                if (stats.projects_by_status[project.status] !== undefined) {
                    stats.projects_by_status[project.status]++;
                }

                // Contar por riesgo
                if (project.risk_level && stats.projects_by_risk[project.risk_level] !== undefined) {
                    stats.projects_by_risk[project.risk_level]++;
                }
            });

            return stats;

        } catch (error) {
            logger.error('Error al obtener estadísticas del programa', {
                error: error.message,
                programId,
                userId
            });
            throw error;
        }
    }

    /**
     * Cambiar estado del programa
     * @param {number} programId - ID del programa
     * @param {string} newStatus - Nuevo estado
     * @param {number} userId - ID del usuario
     * @returns {Promise<Object>} Programa actualizado
     */
    async changeProgramStatus(programId, newStatus, userId) {
        try {
            if (!['activo', 'pausado', 'completado', 'cancelado'].includes(newStatus)) {
                throw new Error('Estado no válido');
            }

            return await this.updateProgram(programId, { status: newStatus }, userId);

        } catch (error) {
            logger.error('Error al cambiar estado del programa', {
                error: error.message,
                programId,
                newStatus,
                userId
            });
            throw error;
        }
    }
}

module.exports = new ProgramService();