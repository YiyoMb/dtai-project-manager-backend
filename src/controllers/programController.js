const programService = require('../services/programService');
const logger = require('../utils/logger');

class ProgramController {
    /**
     * Crear un nuevo programa
     * POST /api/programs
     */
    async createProgram(req, res) {
        try {
            const { portfolio_id, name, description, status } = req.body;
            const userId = req.user.id;

            logger.info(`Usuario ${userId} intentando crear programa`, {
                programName: name,
                portfolioId: portfolio_id,
                userId
            });

            const program = await programService.createProgram(
                { portfolio_id, name, description, status },
                userId
            );

            res.status(201).json({
                success: true,
                message: 'Programa creado exitosamente',
                data: program
            });

        } catch (error) {
            logger.error('Error en createProgram controller', {
                error: error.message,
                userId: req.user?.id,
                body: req.body
            });

            if (error.message.includes('Ya existe un programa')) {
                return res.status(409).json({
                    success: false,
                    message: error.message,
                    code: 'DUPLICATE_PROGRAM_NAME'
                });
            }

            if (error.message.includes('Portfolio no encontrado')) {
                return res.status(404).json({
                    success: false,
                    message: 'Portfolio no encontrado',
                    code: 'PORTFOLIO_NOT_FOUND'
                });
            }

            if (error.message.includes('No tienes permisos')) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para crear programas en este portfolio',
                    code: 'INSUFFICIENT_PERMISSIONS'
                });
            }

            if (error.message.includes('Usuario no válido')) {
                return res.status(403).json({
                    success: false,
                    message: 'Usuario no autorizado',
                    code: 'INVALID_USER'
                });
            }

            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Obtener programa por ID
     * GET /api/programs/:id
     */
    async getProgramById(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            if (!Number.isInteger(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de programa inválido',
                    code: 'INVALID_PROGRAM_ID'
                });
            }

            const program = await programService.getProgramById(parseInt(id), userId);

            res.status(200).json({
                success: true,
                message: 'Programa obtenido exitosamente',
                data: program
            });

        } catch (error) {
            logger.error('Error en getProgramById controller', {
                error: error.message,
                programId: req.params.id,
                userId: req.user?.id
            });

            if (error.message.includes('no encontrado')) {
                return res.status(404).json({
                    success: false,
                    message: 'Programa no encontrado',
                    code: 'PROGRAM_NOT_FOUND'
                });
            }

            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Obtener programas de un portfolio
     * GET /api/portfolios/:portfolioId/programs
     */
    async getProgramsByPortfolio(req, res) {
        try {
            const { portfolioId } = req.params;
            const userId = req.user.id;
            const {
                page = 1,
                limit = 10,
                search = '',
                status = '',
                include_projects = 'false'
            } = req.query;

            if (!Number.isInteger(parseInt(portfolioId))) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de portfolio inválido',
                    code: 'INVALID_PORTFOLIO_ID'
                });
            }

            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);

            if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
                return res.status(400).json({
                    success: false,
                    message: 'Parámetros de paginación inválidos',
                    code: 'INVALID_PAGINATION'
                });
            }

            const options = {
                page: pageNum,
                limit: limitNum,
                search: search.trim(),
                status: status.trim(),
                include_projects: include_projects === 'true'
            };

            const result = await programService.getProgramsByPortfolio(
                parseInt(portfolioId),
                userId,
                options
            );

            res.status(200).json({
                success: true,
                message: 'Programas obtenidos exitosamente',
                data: result.programs,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error('Error en getProgramsByPortfolio controller', {
                error: error.message,
                portfolioId: req.params.portfolioId,
                userId: req.user?.id,
                query: req.query
            });

            if (error.message.includes('Portfolio no encontrado')) {
                return res.status(404).json({
                    success: false,
                    message: 'Portfolio no encontrado',
                    code: 'PORTFOLIO_NOT_FOUND'
                });
            }

            if (error.message.includes('No tienes permisos')) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para ver los programas de este portfolio',
                    code: 'INSUFFICIENT_PERMISSIONS'
                });
            }

            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Actualizar programa
     * PUT /api/programs/:id
     */
    async updateProgram(req, res) {
        try {
            const { id } = req.params;
            const { name, description, status } = req.body;
            const userId = req.user.id;

            if (!Number.isInteger(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de programa inválido',
                    code: 'INVALID_PROGRAM_ID'
                });
            }

            const program = await programService.updateProgram(
                parseInt(id),
                { name, description, status },
                userId
            );

            res.status(200).json({
                success: true,
                message: 'Programa actualizado exitosamente',
                data: program
            });

        } catch (error) {
            logger.error('Error en updateProgram controller', {
                error: error.message,
                programId: req.params.id,
                userId: req.user?.id,
                body: req.body
            });

            if (error.message.includes('no encontrado')) {
                return res.status(404).json({
                    success: false,
                    message: 'Programa no encontrado',
                    code: 'PROGRAM_NOT_FOUND'
                });
            }

            if (error.message.includes('No tienes permisos')) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para editar este programa',
                    code: 'INSUFFICIENT_PERMISSIONS'
                });
            }

            if (error.message.includes('Ya existe un programa')) {
                return res.status(409).json({
                    success: false,
                    message: error.message,
                    code: 'DUPLICATE_PROGRAM_NAME'
                });
            }

            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Eliminar programa
     * DELETE /api/programs/:id
     */
    async deleteProgram(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            if (!Number.isInteger(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de programa inválido',
                    code: 'INVALID_PROGRAM_ID'
                });
            }

            await programService.deleteProgram(parseInt(id), userId);

            res.status(200).json({
                success: true,
                message: 'Programa eliminado exitosamente'
            });

        } catch (error) {
            logger.error('Error en deleteProgram controller', {
                error: error.message,
                programId: req.params.id,
                userId: req.user?.id
            });

            if (error.message.includes('no encontrado')) {
                return res.status(404).json({
                    success: false,
                    message: 'Programa no encontrado',
                    code: 'PROGRAM_NOT_FOUND'
                });
            }

            if (error.message.includes('No tienes permisos')) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para eliminar este programa',
                    code: 'INSUFFICIENT_PERMISSIONS'
                });
            }

            if (error.message.includes('contiene proyectos')) {
                return res.status(400).json({
                    success: false,
                    message: 'No se puede eliminar un programa que contiene proyectos',
                    code: 'PROGRAM_HAS_PROJECTS'
                });
            }

            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Obtener estadísticas del programa
     * GET /api/programs/:id/stats
     */
    async getProgramStats(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            if (!Number.isInteger(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de programa inválido',
                    code: 'INVALID_PROGRAM_ID'
                });
            }

            const stats = await programService.getProgramStats(parseInt(id), userId);

            res.status(200).json({
                success: true,
                message: 'Estadísticas obtenidas exitosamente',
                data: stats
            });

        } catch (error) {
            logger.error('Error en getProgramStats controller', {
                error: error.message,
                programId: req.params.id,
                userId: req.user?.id
            });

            if (error.message.includes('no encontrado')) {
                return res.status(404).json({
                    success: false,
                    message: 'Programa no encontrado',
                    code: 'PROGRAM_NOT_FOUND'
                });
            }

            if (error.message.includes('No tienes permisos')) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para ver estadísticas de este programa',
                    code: 'INSUFFICIENT_PERMISSIONS'
                });
            }

            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Cambiar estado del programa
     * PATCH /api/programs/:id/status
     */
    async changeProgramStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const userId = req.user.id;

            if (!Number.isInteger(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de programa inválido',
                    code: 'INVALID_PROGRAM_ID'
                });
            }

            const program = await programService.changeProgramStatus(
                parseInt(id),
                status,
                userId
            );

            res.status(200).json({
                success: true,
                message: 'Estado del programa actualizado exitosamente',
                data: program
            });

        } catch (error) {
            logger.error('Error en changeProgramStatus controller', {
                error: error.message,
                programId: req.params.id,
                status: req.body.status,
                userId: req.user?.id
            });

            if (error.message.includes('no encontrado')) {
                return res.status(404).json({
                    success: false,
                    message: 'Programa no encontrado',
                    code: 'PROGRAM_NOT_FOUND'
                });
            }

            if (error.message.includes('Estado no válido')) {
                return res.status(400).json({
                    success: false,
                    message: 'Estado no válido. Use: activo, pausado, completado o cancelado',
                    code: 'INVALID_STATUS'
                });
            }

            if (error.message.includes('No tienes permisos')) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para cambiar el estado de este programa',
                    code: 'INSUFFICIENT_PERMISSIONS'
                });
            }

            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                code: 'INTERNAL_ERROR'
            });
        }
    }
}

module.exports = new ProgramController();