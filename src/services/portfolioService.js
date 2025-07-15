const Portfolio = require('../models/Portfolio');
const User = require('../models/User');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

class PortfolioService {
    /**
     * Crear un nuevo portfolio
     * @param {Object} portfolioData - Datos del portfolio
     * @param {number} userId - ID del usuario creador
     * @returns {Promise<Object>} Portfolio creado
     */
    async createPortfolio(portfolioData, userId) {
        try {
            logger.info(`Iniciando creación de portfolio por usuario ${userId}`, {
                portfolioName: portfolioData.name,
                userId
            });

            // Verificar que el usuario existe y está activo
            const user = await User.findByPk(userId);
            if (!user || !user.is_active) {
                throw new Error('Usuario no válido o inactivo');
            }

            // Verificar que no existe un portfolio con el mismo nombre del mismo usuario
            const existingPortfolio = await Portfolio.findOne({
                where: {
                    name: portfolioData.name,
                    created_by: userId
                }
            });

            if (existingPortfolio) {
                throw new Error('Ya existe un portfolio con este nombre');
            }

            // Crear el portfolio
            const portfolio = await Portfolio.create({
                name: portfolioData.name.trim(),
                description: portfolioData.description?.trim() || null,
                created_by: userId
            });

            logger.info(`Portfolio creado exitosamente con ID ${portfolio.id}`, {
                portfolioId: portfolio.id,
                portfolioName: portfolio.name,
                userId
            });

            // Devolver el portfolio con información del creador
            return await this.getPortfolioById(portfolio.id, userId);

        } catch (error) {
            logger.error('Error al crear portfolio', {
                error: error.message,
                portfolioData,
                userId
            });
            throw error;
        }
    }

    /**
     * Obtener portfolio por ID
     * @param {number} portfolioId - ID del portfolio
     * @param {number} userId - ID del usuario que consulta
     * @returns {Promise<Object>} Portfolio con datos relacionados
     */
    async getPortfolioById(portfolioId, userId) {
        try {
            const portfolio = await Portfolio.findByPk(portfolioId, {
                include: [
                    {
                        association: 'creator',
                        attributes: ['id', 'name', 'email']
                    },
                    {
                        association: 'programs',
                        required: false, // LEFT JOIN para incluir portfolios sin programas
                        include: [
                            {
                                association: 'projects',
                                required: false
                            }
                        ]
                    }
                ]
            });

            if (!portfolio) {
                throw new Error('Portfolio no encontrado');
            }

            // Verificar permisos (solo el creador o admin puede ver detalles completos)
            const user = await User.findByPk(userId, { include: ['role'] });
            const canViewFull = portfolio.created_by === userId ||
                user.role.name === 'superadministrador' ||
                user.role.name === 'administrador';

            if (!canViewFull) {
                // Devolver versión limitada para colaboradores
                return {
                    id: portfolio.id,
                    name: portfolio.name,
                    description: portfolio.description,
                    created_at: portfolio.created_at,
                    programs_count: portfolio.programs?.length || 0
                };
            }

            return portfolio;

        } catch (error) {
            logger.error('Error al obtener portfolio', {
                error: error.message,
                portfolioId,
                userId
            });
            throw error;
        }
    }

    /**
     * Obtener todos los portfolios del usuario
     * @param {number} userId - ID del usuario
     * @param {Object} options - Opciones de consulta
     * @returns {Promise<Array>} Lista de portfolios
     */
    async getUserPortfolios(userId, options = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                search = '',
                include_programs = false
            } = options;

            const offset = (page - 1) * limit;

            const whereClause = {
                created_by: userId
            };

            // Agregar búsqueda si se proporciona
            if (search.trim()) {
                whereClause[Op.or] = [
                    { name: { [Op.like]: `%${search.trim()}%` } },
                    { description: { [Op.like]: `%${search.trim()}%` } }
                ];
            }

            const includeOptions = [
                {
                    association: 'creator',
                    attributes: ['id', 'name', 'email']
                }
            ];

            if (include_programs) {
                includeOptions.push({
                    association: 'programs',
                    required: false,
                    include: [
                        {
                            association: 'projects',
                            required: false,
                            attributes: ['id', 'name', 'status']
                        }
                    ]
                });
            }

            const { count, rows } = await Portfolio.findAndCountAll({
                where: whereClause,
                include: includeOptions,
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['created_at', 'DESC']],
                distinct: true // Para contar correctamente con JOINs
            });

            return {
                portfolios: rows,
                pagination: {
                    total: count,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(count / limit)
                }
            };

        } catch (error) {
            logger.error('Error al obtener portfolios del usuario', {
                error: error.message,
                userId,
                options
            });
            throw error;
        }
    }

    /**
     * Actualizar portfolio
     * @param {number} portfolioId - ID del portfolio
     * @param {Object} updateData - Datos a actualizar
     * @param {number} userId - ID del usuario que actualiza
     * @returns {Promise<Object>} Portfolio actualizado
     */
    async updatePortfolio(portfolioId, updateData, userId) {
        try {
            const portfolio = await Portfolio.findByPk(portfolioId);

            if (!portfolio) {
                throw new Error('Portfolio no encontrado');
            }

            // Verificar permisos de edición
            const user = await User.findByPk(userId, { include: ['role'] });
            const canEdit = portfolio.created_by === userId ||
                user.role.name === 'superadministrador' ||
                user.role.name === 'administrador';

            if (!canEdit) {
                throw new Error('No tienes permisos para editar este portfolio');
            }

            // Verificar nombre único si se está cambiando
            if (updateData.name && updateData.name !== portfolio.name) {
                const existingPortfolio = await Portfolio.findOne({
                    where: {
                        name: updateData.name,
                        created_by: portfolio.created_by,
                        id: { [Op.ne]: portfolioId }
                    }
                });

                if (existingPortfolio) {
                    throw new Error('Ya existe un portfolio con este nombre');
                }
            }

            // Actualizar campos permitidos
            const allowedFields = ['name', 'description'];
            const updateFields = {};

            allowedFields.forEach(field => {
                if (updateData[field] !== undefined) {
                    updateFields[field] = typeof updateData[field] === 'string'
                        ? updateData[field].trim()
                        : updateData[field];
                }
            });

            await portfolio.update(updateFields);

            logger.info(`Portfolio ${portfolioId} actualizado por usuario ${userId}`, {
                portfolioId,
                userId,
                updatedFields: Object.keys(updateFields)
            });

            return await this.getPortfolioById(portfolioId, userId);

        } catch (error) {
            logger.error('Error al actualizar portfolio', {
                error: error.message,
                portfolioId,
                updateData,
                userId
            });
            throw error;
        }
    }

    /**
     * Eliminar portfolio
     * @param {number} portfolioId - ID del portfolio
     * @param {number} userId - ID del usuario que elimina
     * @returns {Promise<boolean>} Resultado de la eliminación
     */
    async deletePortfolio(portfolioId, userId) {
        try {
            const portfolio = await Portfolio.findByPk(portfolioId, {
                include: ['programs']
            });

            if (!portfolio) {
                throw new Error('Portfolio no encontrado');
            }

            // Verificar permisos de eliminación
            const user = await User.findByPk(userId, { include: ['role'] });
            const canDelete = portfolio.created_by === userId ||
                user.role.name === 'superadministrador';

            if (!canDelete) {
                throw new Error('No tienes permisos para eliminar este portfolio');
            }

            // Verificar que no tenga programas asociados
            if (portfolio.programs && portfolio.programs.length > 0) {
                throw new Error('No se puede eliminar un portfolio que contiene programas');
            }

            await portfolio.destroy();

            logger.info(`Portfolio ${portfolioId} eliminado por usuario ${userId}`, {
                portfolioId,
                portfolioName: portfolio.name,
                userId
            });

            return true;

        } catch (error) {
            logger.error('Error al eliminar portfolio', {
                error: error.message,
                portfolioId,
                userId
            });
            throw error;
        }
    }

    /**
     * Obtener estadísticas del portfolio
     * @param {number} portfolioId - ID del portfolio
     * @param {number} userId - ID del usuario que consulta
     * @returns {Promise<Object>} Estadísticas del portfolio
     */
    async getPortfolioStats(portfolioId, userId) {
        try {
            const portfolio = await Portfolio.findByPk(portfolioId, {
                include: [
                    {
                        association: 'programs',
                        include: [
                            {
                                association: 'projects',
                                attributes: ['id', 'status', 'risk_level']
                            }
                        ]
                    }
                ]
            });

            if (!portfolio) {
                throw new Error('Portfolio no encontrado');
            }

            // Verificar permisos
            const user = await User.findByPk(userId, { include: ['role'] });
            const canView = portfolio.created_by === userId ||
                user.role.name === 'superadministrador' ||
                user.role.name === 'administrador';

            if (!canView) {
                throw new Error('No tienes permisos para ver estadísticas de este portfolio');
            }

            // Calcular estadísticas
            const stats = {
                portfolio_id: portfolioId,
                portfolio_name: portfolio.name,
                programs_count: portfolio.programs?.length || 0,
                projects_count: 0,
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
            portfolio.programs?.forEach(program => {
                if (program.projects) {
                    stats.projects_count += program.projects.length;

                    program.projects.forEach(project => {
                        // Contar por estado
                        if (stats.projects_by_status[project.status] !== undefined) {
                            stats.projects_by_status[project.status]++;
                        }

                        // Contar por riesgo
                        if (project.risk_level && stats.projects_by_risk[project.risk_level] !== undefined) {
                            stats.projects_by_risk[project.risk_level]++;
                        }
                    });
                }
            });

            return stats;

        } catch (error) {
            logger.error('Error al obtener estadísticas del portfolio', {
                error: error.message,
                portfolioId,
                userId
            });
            throw error;
        }
    }
}

module.exports = new PortfolioService();