const projectService = require('../services/projectService');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');

class ProjectController {
    /**
     * Crear un nuevo proyecto
     * POST /api/projects
     */
    async createProject(req, res) {
        try {
            // Validar entrada
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Errores de validación',
                    errors: errors.array()
                });
            }

            const project = await projectService.createProject(req.body, req.user.id);

            res.status(201).json({
                success: true,
                message: 'Proyecto creado exitosamente',
                data: project
            });

        } catch (error) {
            logger.error('Error en createProject:', error);

            // Manejar errores específicos
            if (error.message.includes('no existe') ||
                error.message.includes('cancelado') ||
                error.message.includes('no válido')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    }

    /**
     * Obtener todos los proyectos con filtros y paginación
     * GET /api/projects
     */
    async getAllProjects(req, res) {
        try {
            const filters = {
                program_id: req.query.program_id,
                status: req.query.status,
                risk_level: req.query.risk_level,
                created_by: req.query.created_by,
                search: req.query.search
            };

            const pagination = {
                page: req.query.page,
                limit: req.query.limit,
                sortBy: req.query.sortBy,
                sortOrder: req.query.sortOrder
            };

            const result = await projectService.getAllProjects(filters, pagination);

            res.json({
                success: true,
                message: 'Proyectos obtenidos exitosamente',
                data: result.projects,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error('Error en getAllProjects:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener proyectos'
            });
        }
    }

    /**
     * Obtener un proyecto por ID
     * GET /api/projects/:id
     */
    async getProjectById(req, res) {
        try {
            const projectId = parseInt(req.params.id);

            if (isNaN(projectId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de proyecto inválido'
                });
            }

            const project = await projectService.getProjectById(projectId);

            res.json({
                success: true,
                message: 'Proyecto obtenido exitosamente',
                data: project
            });

        } catch (error) {
            logger.error('Error en getProjectById:', error);

            if (error.message === 'Proyecto no encontrado') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Error al obtener proyecto'
            });
        }
    }

    /**
     * Actualizar un proyecto
     * PUT /api/projects/:id
     */
    async updateProject(req, res) {
        try {
            // Validar entrada
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Errores de validación',
                    errors: errors.array()
                });
            }

            const projectId = parseInt(req.params.id);

            if (isNaN(projectId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de proyecto inválido'
                });
            }

            const project = await projectService.updateProject(projectId, req.body, req.user.id);

            res.json({
                success: true,
                message: 'Proyecto actualizado exitosamente',
                data: project
            });

        } catch (error) {
            logger.error('Error en updateProject:', error);

            if (error.message === 'Proyecto no encontrado') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }

            if (error.message.includes('no existe') ||
                error.message.includes('cancelado')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Error al actualizar proyecto'
            });
        }
    }

    /**
     * Eliminar un proyecto
     * DELETE /api/projects/:id
     */
    async deleteProject(req, res) {
        try {
            const projectId = parseInt(req.params.id);

            if (isNaN(projectId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de proyecto inválido'
                });
            }

            await projectService.deleteProject(projectId, req.user.id);

            res.json({
                success: true,
                message: 'Proyecto eliminado exitosamente'
            });

        } catch (error) {
            logger.error('Error en deleteProject:', error);

            if (error.message === 'Proyecto no encontrado') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }

            if (error.message.includes('en proceso')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Error al eliminar proyecto'
            });
        }
    }

    /**
     * Obtener proyectos por programa
     * GET /api/projects/program/:programId
     */
    async getProjectsByProgram(req, res) {
        try {
            const programId = parseInt(req.params.programId);

            if (isNaN(programId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de programa inválido'
                });
            }

            const options = {
                status: req.query.status,
                risk_level: req.query.risk_level,
                includeDetails: req.query.includeDetails === 'true'
            };

            const projects = await projectService.getProjectsByProgram(programId, options);

            res.json({
                success: true,
                message: 'Proyectos del programa obtenidos exitosamente',
                data: projects
            });

        } catch (error) {
            logger.error('Error en getProjectsByProgram:', error);

            if (error.message === 'Programa no encontrado') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Error al obtener proyectos del programa'
            });
        }
    }

    /**
     * Obtener proyectos de alto riesgo
     * GET /api/projects/high-risk
     */
    async getHighRiskProjects(req, res) {
        try {
            const programId = req.query.program_id ? parseInt(req.query.program_id) : null;

            const projects = await projectService.getHighRiskProjects(programId);

            res.json({
                success: true,
                message: 'Proyectos de alto riesgo obtenidos exitosamente',
                data: projects
            });

        } catch (error) {
            logger.error('Error en getHighRiskProjects:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener proyectos de alto riesgo'
            });
        }
    }

    /**
     * Obtener estadísticas de proyectos por programa
     * GET /api/projects/stats/program/:programId
     */
    async getProjectStatsByProgram(req, res) {
        try {
            const programId = parseInt(req.params.programId);

            if (isNaN(programId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de programa inválido'
                });
            }

            const stats = await projectService.getProjectStatsByProgram(programId);

            res.json({
                success: true,
                message: 'Estadísticas del programa obtenidas exitosamente',
                data: stats
            });

        } catch (error) {
            logger.error('Error en getProjectStatsByProgram:', error);

            if (error.message === 'Programa no encontrado') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Error al obtener estadísticas del programa'
            });
        }
    }

    /**
     * Cambiar estado de un proyecto
     * PATCH /api/projects/:id/status
     */
    async changeProjectStatus(req, res) {
        try {
            const projectId = parseInt(req.params.id);
            const { status } = req.body;

            if (isNaN(projectId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de proyecto inválido'
                });
            }

            if (!status) {
                return res.status(400).json({
                    success: false,
                    message: 'El campo status es requerido'
                });
            }

            const project = await projectService.changeProjectStatus(projectId, status, req.user.id);

            res.json({
                success: true,
                message: 'Estado del proyecto actualizado exitosamente',
                data: project
            });

        } catch (error) {
            logger.error('Error en changeProjectStatus:', error);

            if (error.message === 'Proyecto no encontrado') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }

            if (error.message.includes('No se puede cambiar')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Error al cambiar estado del proyecto'
            });
        }
    }

    /**
     * Obtener proyectos por nivel de riesgo
     * GET /api/projects/risk/:riskLevel
     */
    async getProjectsByRiskLevel(req, res) {
        try {
            const { riskLevel } = req.params;
            const limit = req.query.limit ? parseInt(req.query.limit) : 10;

            const validRiskLevels = ['bajo', 'medio', 'alto', 'critico'];
            if (!validRiskLevels.includes(riskLevel)) {
                return res.status(400).json({
                    success: false,
                    message: 'Nivel de riesgo inválido'
                });
            }

            const projects = await projectService.getProjectsByRiskLevel(riskLevel, limit);

            res.json({
                success: true,
                message: `Proyectos de riesgo ${riskLevel} obtenidos exitosamente`,
                data: projects
            });

        } catch (error) {
            logger.error('Error en getProjectsByRiskLevel:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener proyectos por nivel de riesgo'
            });
        }
    }

    /**
     * Obtener dashboard de proyectos
     * GET /api/projects/dashboard
     */
    async getProjectsDashboard(req, res) {
        try {
            const filters = {
                program_id: req.query.program_id ? parseInt(req.query.program_id) : null,
                portfolio_id: req.query.portfolio_id ? parseInt(req.query.portfolio_id) : null
            };

            const dashboard = await projectService.getProjectsDashboard(filters);

            res.json({
                success: true,
                message: 'Dashboard de proyectos obtenido exitosamente',
                data: dashboard
            });

        } catch (error) {
            logger.error('Error en getProjectsDashboard:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener dashboard de proyectos'
            });
        }
    }

    /**
     * Obtener estadísticas específicas de un proyecto
     * GET /api/projects/:id/stats
     */
    async getProjectStats(req, res) {
        try {
            const projectId = parseInt(req.params.id);

            if (isNaN(projectId)) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de proyecto inválido'
                });
            }

            // Obtener el proyecto con detalles completos
            const project = await projectService.getProjectById(projectId);

            // Crear estadísticas del proyecto
            const stats = {
                project_info: {
                    id: project.id,
                    name: project.name,
                    status: project.status,
                    risk_level: project.risk_level,
                    created_at: project.created_at,
                    program: project.program,
                    creator: project.creator
                },
                status_info: {
                    current_status: project.status,
                    is_pending: project.status === 'pendiente',
                    is_in_progress: project.status === 'en_proceso',
                    is_completed: project.status === 'completado',
                    is_canceled: project.status === 'cancelado'
                },
                risk_info: {
                    current_risk: project.risk_level,
                    is_low_risk: project.risk_level === 'bajo',
                    is_medium_risk: project.risk_level === 'medio',
                    is_high_risk: project.risk_level === 'alto',
                    is_critical: project.risk_level === 'critico'
                },
                program_context: {
                    program_id: project.program.id,
                    program_name: project.program.name,
                    program_status: project.program.status,
                    portfolio_id: project.program.portfolio?.id,
                    portfolio_name: project.program.portfolio?.name
                },
                computed_at: new Date()
            };

            res.json({
                success: true,
                message: 'Estadísticas del proyecto obtenidas exitosamente',
                data: stats
            });

        } catch (error) {
            logger.error('Error en getProjectStats:', error);

            if (error.message === 'Proyecto no encontrado') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }

            res.status(500).json({
                success: false,
                message: 'Error al obtener estadísticas del proyecto'
            });
        }
    }
}

module.exports = new ProjectController();