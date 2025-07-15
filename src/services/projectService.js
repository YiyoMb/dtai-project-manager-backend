const Project = require('../models/Project');
const Program = require('../models/Program');
const User = require('../models/User');
const Portfolio = require('../models/Portfolio');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

class ProjectService {
    /**
     * Crear un nuevo proyecto
     * @param {Object} projectData - Datos del proyecto
     * @param {number} createdBy - ID del usuario creador
     * @returns {Promise<Object>} - Proyecto creado
     */
    async createProject(projectData, createdBy) {
        try {
            // Validar que el programa existe y está activo
            const program = await Program.findByPk(projectData.program_id);
            if (!program) {
                throw new Error('El programa especificado no existe');
            }
            if (program.status === 'cancelado') {
                throw new Error('No se pueden crear proyectos en un programa cancelado');
            }

            // Validar que el usuario creador existe y está activo
            const creator = await User.findByPk(createdBy);
            if (!creator || !creator.is_active) {
                throw new Error('Usuario creador no válido o inactivo');
            }

            // Crear el proyecto
            const project = await Project.create({
                ...projectData,
                created_by: createdBy,
                risk_level: projectData.risk_level || 'bajo'
            });

            // Obtener el proyecto con sus relaciones
            const createdProject = await Project.findWithFullDetails(project.id);

            logger.info(`Proyecto creado: ${project.name} por usuario ${createdBy}`);
            return createdProject;

        } catch (error) {
            logger.error('Error al crear proyecto:', error);
            throw error;
        }
    }

    /**
     * Obtener todos los proyectos con filtros opcionales
     * @param {Object} filters - Filtros de búsqueda
     * @param {Object} pagination - Opciones de paginación
     * @returns {Promise<Object>} - Lista de proyectos paginada
     */
    async getAllProjects(filters = {}, pagination = {}) {
        try {
            const {
                program_id,
                status,
                risk_level,
                created_by,
                search
            } = filters;

            const {
                page = 1,
                limit = 10,
                sortBy = 'created_at',
                sortOrder = 'DESC'
            } = pagination;

            // Construir condiciones WHERE
            const whereClause = {};

            if (program_id) {
                whereClause.program_id = program_id;
            }
            if (status) {
                whereClause.status = status;
            }
            if (risk_level) {
                whereClause.risk_level = risk_level;
            }
            if (created_by) {
                whereClause.created_by = created_by;
            }
            if (search) {
                whereClause[Op.or] = [
                    { name: { [Op.like]: `%${search}%` } },
                    { description: { [Op.like]: `%${search}%` } }
                ];
            }

            // Calcular offset para paginación
            const offset = (page - 1) * limit;

            // Obtener proyectos con relaciones
            const { count, rows } = await Project.findAndCountAll({
                where: whereClause,
                include: [
                    {
                        association: 'program',
                        attributes: ['id', 'name', 'status'],
                        include: [
                            {
                                association: 'portfolio',
                                attributes: ['id', 'name']
                            }
                        ]
                    },
                    {
                        association: 'creator',
                        attributes: ['id', 'name', 'email']
                    }
                ],
                order: [[sortBy, sortOrder]],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            return {
                projects: rows,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(count / limit),
                    totalItems: count,
                    itemsPerPage: parseInt(limit),
                    hasNextPage: page < Math.ceil(count / limit),
                    hasPreviousPage: page > 1
                }
            };

        } catch (error) {
            logger.error('Error al obtener proyectos:', error);
            throw error;
        }
    }

    /**
     * Obtener un proyecto por ID
     * @param {number} projectId - ID del proyecto
     * @returns {Promise<Object>} - Proyecto encontrado
     */
    async getProjectById(projectId) {
        try {
            const project = await Project.findWithFullDetails(projectId);

            if (!project) {
                throw new Error('Proyecto no encontrado');
            }

            return project;

        } catch (error) {
            logger.error(`Error al obtener proyecto ${projectId}:`, error);
            throw error;
        }
    }

    /**
     * Actualizar un proyecto
     * @param {number} projectId - ID del proyecto
     * @param {Object} updateData - Datos a actualizar
     * @param {number} updatedBy - ID del usuario que actualiza
     * @returns {Promise<Object>} - Proyecto actualizado
     */
    async updateProject(projectId, updateData, updatedBy) {
        try {
            // Verificar que el proyecto existe
            const project = await Project.findByPk(projectId);
            if (!project) {
                throw new Error('Proyecto no encontrado');
            }

            // Validar programa si se está cambiando
            if (updateData.program_id && updateData.program_id !== project.program_id) {
                const newProgram = await Program.findByPk(updateData.program_id);
                if (!newProgram) {
                    throw new Error('El nuevo programa especificado no existe');
                }
                if (newProgram.status === 'cancelado') {
                    throw new Error('No se puede mover un proyecto a un programa cancelado');
                }
            }

            // Actualizar el proyecto
            await project.update(updateData);

            // Obtener el proyecto actualizado con sus relaciones
            const updatedProject = await Project.findWithFullDetails(projectId);

            logger.info(`Proyecto actualizado: ${project.name} por usuario ${updatedBy}`);
            return updatedProject;

        } catch (error) {
            logger.error(`Error al actualizar proyecto ${projectId}:`, error);
            throw error;
        }
    }

    /**
     * Eliminar un proyecto
     * @param {number} projectId - ID del proyecto
     * @param {number} deletedBy - ID del usuario que elimina
     * @returns {Promise<boolean>} - Resultado de la eliminación
     */
    async deleteProject(projectId, deletedBy) {
        try {
            const project = await Project.findByPk(projectId);
            if (!project) {
                throw new Error('Proyecto no encontrado');
            }

            // Verificar que el proyecto se puede eliminar
            if (project.status === 'en_proceso') {
                throw new Error('No se puede eliminar un proyecto en proceso');
            }

            await project.destroy();

            logger.info(`Proyecto eliminado: ${project.name} por usuario ${deletedBy}`);
            return true;

        } catch (error) {
            logger.error(`Error al eliminar proyecto ${projectId}:`, error);
            throw error;
        }
    }

    /**
     * Obtener proyectos por programa
     * @param {number} programId - ID del programa
     * @param {Object} options - Opciones de filtrado
     * @returns {Promise<Array>} - Lista de proyectos
     */
    async getProjectsByProgram(programId, options = {}) {
        try {
            // Verificar que el programa existe
            const program = await Program.findByPk(programId);
            if (!program) {
                throw new Error('Programa no encontrado');
            }

            const projects = await Project.findByProgram(programId, options);
            return projects;

        } catch (error) {
            logger.error(`Error al obtener proyectos del programa ${programId}:`, error);
            throw error;
        }
    }

    /**
     * Obtener proyectos de alto riesgo
     * @param {number} programId - ID del programa (opcional)
     * @returns {Promise<Array>} - Lista de proyectos de alto riesgo
     */
    async getHighRiskProjects(programId = null) {
        try {
            const projects = await Project.findHighRiskProjects(programId);
            return projects;

        } catch (error) {
            logger.error('Error al obtener proyectos de alto riesgo:', error);
            throw error;
        }
    }

    /**
     * Obtener estadísticas de proyectos por programa
     * @param {number} programId - ID del programa
     * @returns {Promise<Object>} - Estadísticas del programa
     */
    async getProjectStatsByProgram(programId) {
        try {
            // Verificar que el programa existe
            const program = await Program.findByPk(programId);
            if (!program) {
                throw new Error('Programa no encontrado');
            }

            const stats = await Project.countByProgram(programId);
            return stats;

        } catch (error) {
            logger.error(`Error al obtener estadísticas del programa ${programId}:`, error);
            throw error;
        }
    }

    /**
     * Cambiar estado de un proyecto
     * @param {number} projectId - ID del proyecto
     * @param {string} newStatus - Nuevo estado
     * @param {number} updatedBy - ID del usuario que cambia el estado
     * @returns {Promise<Object>} - Proyecto actualizado
     */
    async changeProjectStatus(projectId, newStatus, updatedBy) {
        try {
            const project = await Project.findByPk(projectId);
            if (!project) {
                throw new Error('Proyecto no encontrado');
            }

            // Validar transición de estado
            const validTransitions = {
                'pendiente': ['en_proceso', 'cancelado'],
                'en_proceso': ['completado', 'cancelado'],
                'completado': [], // No se puede cambiar desde completado
                'cancelado': ['pendiente'] // Solo se puede reactivar
            };

            if (!validTransitions[project.status].includes(newStatus)) {
                throw new Error(`No se puede cambiar de ${project.status} a ${newStatus}`);
            }

            await project.update({ status: newStatus });

            const updatedProject = await Project.findWithFullDetails(projectId);

            logger.info(`Estado del proyecto ${project.name} cambiado a ${newStatus} por usuario ${updatedBy}`);
            return updatedProject;

        } catch (error) {
            logger.error(`Error al cambiar estado del proyecto ${projectId}:`, error);
            throw error;
        }
    }

    /**
     * Obtener proyectos por nivel de riesgo
     * @param {string} riskLevel - Nivel de riesgo
     * @param {number} limit - Límite de resultados
     * @returns {Promise<Array>} - Lista de proyectos
     */
    async getProjectsByRiskLevel(riskLevel, limit = 10) {
        try {
            const projects = await Project.getProjectsByRiskLevel(riskLevel, limit);
            return projects;

        } catch (error) {
            logger.error(`Error al obtener proyectos por nivel de riesgo ${riskLevel}:`, error);
            throw error;
        }
    }

    /**
     * Obtener dashboard de proyectos
     * @param {Object} filters - Filtros opcionales
     * @returns {Promise<Object>} - Datos del dashboard
     */
    async getProjectsDashboard(filters = {}) {
        try {
            const { program_id, portfolio_id } = filters;

            // Construir WHERE clause base
            let whereClause = {};
            let programWhere = {};

            if (program_id) {
                whereClause.program_id = program_id;
            }

            if (portfolio_id) {
                programWhere.portfolio_id = portfolio_id;
            }

            // Obtener conteos por estado
            const statusCounts = await Project.findAll({
                attributes: [
                    'status',
                    [Project.sequelize.fn('COUNT', Project.sequelize.col('Project.id')), 'count']
                ],
                where: whereClause,
                include: programWhere.portfolio_id ? [
                    {
                        model: Program,
                        as: 'program',
                        where: programWhere,
                        attributes: []
                    }
                ] : [],
                group: ['status'],
                raw: true
            });

            // Obtener conteos por riesgo
            const riskCounts = await Project.findAll({
                attributes: [
                    'risk_level',
                    [Project.sequelize.fn('COUNT', Project.sequelize.col('Project.id')), 'count']
                ],
                where: whereClause,
                include: programWhere.portfolio_id ? [
                    {
                        model: Program,
                        as: 'program',
                        where: programWhere,
                        attributes: []
                    }
                ] : [],
                group: ['risk_level'],
                raw: true
            });

            // Proyectos críticos recientes
            const criticalProjects = await Project.findAll({
                where: {
                    ...whereClause,
                    risk_level: 'critico',
                    status: ['pendiente', 'en_proceso']
                },
                include: [
                    {
                        model: Program,
                        as: 'program',
                        where: programWhere,
                        attributes: ['id', 'name'],
                        include: [
                            {
                                model: Portfolio,
                                as: 'portfolio',
                                attributes: ['id', 'name']
                            }
                        ]
                    }
                ],
                order: [['created_at', 'DESC']],
                limit: 5
            });

            // Formatear resultados
            const dashboard = {
                summary: {
                    by_status: {},
                    by_risk: {},
                    total: 0
                },
                critical_projects: criticalProjects,
                updated_at: new Date()
            };

            // Procesar conteos por estado
            statusCounts.forEach(item => {
                dashboard.summary.by_status[item.status] = parseInt(item.count);
                dashboard.summary.total += parseInt(item.count);
            });

            // Procesar conteos por riesgo
            riskCounts.forEach(item => {
                dashboard.summary.by_risk[item.risk_level] = parseInt(item.count);
            });

            return dashboard;

        } catch (error) {
            logger.error('Error al obtener dashboard de proyectos:', error);
            throw error;
        }
    }
}

module.exports = new ProjectService();