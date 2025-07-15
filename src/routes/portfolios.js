const express = require('express');
const router = express.Router();

// Middlewares
const authMiddleware = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const rateLimit = require('express-rate-limit');

// Controlador y validaciones
const portfolioController = require('../controllers/portfolioController');
const portfolioValidations = require('../middleware/portfolioValidations');

// Rate limiting específico para portfolios
const portfolioRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // máximo 100 requests por ventana por IP
    message: {
        success: false,
        message: 'Demasiadas solicitudes, intente nuevamente en 15 minutos',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limiting más estricto para operaciones de escritura
const writeOperationsRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 20, // máximo 20 operaciones de escritura por ventana
    message: {
        success: false,
        message: 'Demasiadas operaciones de escritura, intente nuevamente en 15 minutos',
        code: 'WRITE_RATE_LIMIT_EXCEEDED'
    }
});

// Aplicar autenticación a todas las rutas
router.use(authMiddleware.authenticate);
//router.use(portfolioRateLimit);

/**
 * @route   GET /api/portfolios
 * @desc    Obtener portfolios del usuario actual
 * @access  Private (Todos los roles autenticados)
 * @query   page, limit, search, include_programs
 */
router.get('/',
    portfolioValidations.validateQueryParams,
    portfolioController.getUserPortfolios
);

/**
 * @route   POST /api/portfolios
 * @desc    Crear un nuevo portfolio
 * @access  Private (Administradores y Superadministradores)
 * @body    { name, description }
 */
router.post('/',
    //writeOperationsRateLimit,
    requireRole(['administrador', 'superadministrador']),
    portfolioValidations.validateCreate,
    portfolioValidations.validatePortfolioName,
    portfolioValidations.validateDescription,
    portfolioValidations.sanitizePortfolioData,
    portfolioController.createPortfolio
);

/**
 * @route   GET /api/portfolios/:id
 * @desc    Obtener portfolio por ID
 * @access  Private (Propietario, Administradores, Superadministradores)
 * @param   id - ID del portfolio
 */
router.get('/:id',
    portfolioValidations.validatePortfolioId,
    portfolioController.getPortfolioById
);

/**
 * @route   PUT /api/portfolios/:id
 * @desc    Actualizar portfolio
 * @access  Private (Propietario, Administradores, Superadministradores)
 * @param   id - ID del portfolio
 * @body    { name?, description? }
 */
router.put('/:id',
    //writeOperationsRateLimit,
    portfolioValidations.validatePortfolioId,
    portfolioValidations.validateUpdate,
    portfolioValidations.validatePortfolioName,
    portfolioValidations.validateDescription,
    portfolioValidations.sanitizePortfolioData,
    portfolioController.updatePortfolio
);

/**
 * @route   DELETE /api/portfolios/:id
 * @desc    Eliminar portfolio
 * @access  Private (Propietario, Superadministradores)
 * @param   id - ID del portfolio
 */
router.delete('/:id',
    //writeOperationsRateLimit,
    portfolioValidations.validatePortfolioId,
    portfolioController.deletePortfolio
);

/**
 * @route   GET /api/portfolios/:id/stats
 * @desc    Obtener estadísticas del portfolio
 * @access  Private (Propietario, Administradores, Superadministradores)
 * @param   id - ID del portfolio
 */
router.get('/:id/stats',
    portfolioValidations.validatePortfolioId,
    portfolioController.getPortfolioStats
);

// Middleware de manejo de errores específico para portfolios
router.use((error, req, res, next) => {
    console.error('Error en rutas de portfolios:', error);

    // Error de validación de Sequelize
    if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({
            success: false,
            message: 'Error de validación',
            code: 'VALIDATION_ERROR',
            details: error.errors.map(err => ({
                field: err.path,
                message: err.message
            }))
        });
    }

    // Error de restricción de base de datos
    if (error.name === 'SequelizeForeignKeyConstraintError') {
        return res.status(400).json({
            success: false,
            message: 'Error de referencia de datos',
            code: 'FOREIGN_KEY_ERROR'
        });
    }

    // Error de unicidad
    if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
            success: false,
            message: 'Ya existe un registro con estos datos',
            code: 'UNIQUE_CONSTRAINT_ERROR'
        });
    }

    // Pasar otros errores al middleware global
    next(error);
});

module.exports = router;