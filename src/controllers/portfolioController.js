const portfolioService = require('../services/portfolioService');
const logger = require('../utils/logger');

class PortfolioController {
    /**
     * Crear un nuevo portfolio
     * POST /api/portfolios
     */
    async createPortfolio(req, res) {
        try {
            const { name, description } = req.body;
            const userId = req.user.id;

            // Log de la operación
            logger.info(`Usuario ${userId} intentando crear portfolio`, {
                portfolioName: name,
                userId
            });

            const portfolio = await portfolioService.createPortfolio(
                { name, description },
                userId
            );

            res.status(201).json({
                success: true,
                message: 'Portfolio creado exitosamente',
                data: portfolio
            });

        } catch (error) {
            logger.error('Error en createPortfolio controller', {
                error: error.message,
                userId: req.user?.id,
                body: req.body
            });

            // Manejar errores específicos
            if (error.message.includes('Ya existe un portfolio')) {
                return res.status(409).json({
                    success: false,
                    message: error.message,
                    code: 'DUPLICATE_PORTFOLIO_NAME'
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
     * Obtener portfolio por ID
     * GET /api/portfolios/:id
     */
    async getPortfolioById(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            // Validar que el ID sea un número
            if (!Number.isInteger(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de portfolio inválido',
                    code: 'INVALID_PORTFOLIO_ID'
                });
            }

            const portfolio = await portfolioService.getPortfolioById(
                parseInt(id),
                userId
            );

            res.status(200).json({
                success: true,
                message: 'Portfolio obtenido exitosamente',
                data: portfolio
            });

        } catch (error) {
            logger.error('Error en getPortfolioById controller', {
                error: error.message,
                portfolioId: req.params.id,
                userId: req.user?.id
            });

            if (error.message.includes('no encontrado')) {
                return res.status(404).json({
                    success: false,
                    message: 'Portfolio no encontrado',
                    code: 'PORTFOLIO_NOT_FOUND'
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
     * Obtener portfolios del usuario actual
     * GET /api/portfolios
     */
    async getUserPortfolios(req, res) {
        try {
            const userId = req.user.id;
            const {
                page = 1,
                limit = 10,
                search = '',
                include_programs = 'false'
            } = req.query;

            // Validar parámetros de paginación
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
                include_programs: include_programs === 'true'
            };

            const result = await portfolioService.getUserPortfolios(userId, options);

            res.status(200).json({
                success: true,
                message: 'Portfolios obtenidos exitosamente',
                data: result.portfolios,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error('Error en getUserPortfolios controller', {
                error: error.message,
                userId: req.user?.id,
                query: req.query
            });

            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Actualizar portfolio
     * PUT /api/portfolios/:id
     */
    async updatePortfolio(req, res) {
        try {
            const { id } = req.params;
            const { name, description } = req.body;
            const userId = req.user.id;

            // Validar que el ID sea un número
            if (!Number.isInteger(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de portfolio inválido',
                    code: 'INVALID_PORTFOLIO_ID'
                });
            }

            const portfolio = await portfolioService.updatePortfolio(
                parseInt(id),
                { name, description },
                userId
            );

            res.status(200).json({
                success: true,
                message: 'Portfolio actualizado exitosamente',
                data: portfolio
            });

        } catch (error) {
            logger.error('Error en updatePortfolio controller', {
                error: error.message,
                portfolioId: req.params.id,
                userId: req.user?.id,
                body: req.body
            });

            if (error.message.includes('no encontrado')) {
                return res.status(404).json({
                    success: false,
                    message: 'Portfolio no encontrado',
                    code: 'PORTFOLIO_NOT_FOUND'
                });
            }

            if (error.message.includes('No tienes permisos')) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para realizar esta acción',
                    code: 'INSUFFICIENT_PERMISSIONS'
                });
            }

            if (error.message.includes('Ya existe un portfolio')) {
                return res.status(409).json({
                    success: false,
                    message: error.message,
                    code: 'DUPLICATE_PORTFOLIO_NAME'
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
     * Eliminar portfolio
     * DELETE /api/portfolios/:id
     */
    async deletePortfolio(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            // Validar que el ID sea un número
            if (!Number.isInteger(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de portfolio inválido',
                    code: 'INVALID_PORTFOLIO_ID'
                });
            }

            await portfolioService.deletePortfolio(parseInt(id), userId);

            res.status(200).json({
                success: true,
                message: 'Portfolio eliminado exitosamente'
            });

        } catch (error) {
            logger.error('Error en deletePortfolio controller', {
                error: error.message,
                portfolioId: req.params.id,
                userId: req.user?.id
            });

            if (error.message.includes('no encontrado')) {
                return res.status(404).json({
                    success: false,
                    message: 'Portfolio no encontrado',
                    code: 'PORTFOLIO_NOT_FOUND'
                });
            }

            if (error.message.includes('No tienes permisos')) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para realizar esta acción',
                    code: 'INSUFFICIENT_PERMISSIONS'
                });
            }

            if (error.message.includes('contiene programas')) {
                return res.status(400).json({
                    success: false,
                    message: 'No se puede eliminar un portfolio que contiene programas',
                    code: 'PORTFOLIO_HAS_PROGRAMS'
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
     * Obtener estadísticas del portfolio
     * GET /api/portfolios/:id/stats
     */
    async getPortfolioStats(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            // Validar que el ID sea un número
            if (!Number.isInteger(parseInt(id))) {
                return res.status(400).json({
                    success: false,
                    message: 'ID de portfolio inválido',
                    code: 'INVALID_PORTFOLIO_ID'
                });
            }

            const stats = await portfolioService.getPortfolioStats(
                parseInt(id),
                userId
            );

            res.status(200).json({
                success: true,
                message: 'Estadísticas obtenidas exitosamente',
                data: stats
            });

        } catch (error) {
            logger.error('Error en getPortfolioStats controller', {
                error: error.message,
                portfolioId: req.params.id,
                userId: req.user?.id
            });

            if (error.message.includes('no encontrado')) {
                return res.status(404).json({
                    success: false,
                    message: 'Portfolio no encontrado',
                    code: 'PORTFOLIO_NOT_FOUND'
                });
            }

            if (error.message.includes('No tienes permisos')) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para ver estas estadísticas',
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

module.exports = new PortfolioController();