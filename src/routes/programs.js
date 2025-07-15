const express = require('express');
const router = express.Router();

// Middlewares
const authMiddleware = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const rateLimit = require('express-rate-limit');

// Controlador y validaciones
const programController = require('../controllers/programController');
const programValidations = require('../middleware/programValidations');
const portfolioValidations = require('../middleware/portfolioValidations');

// Rate limiting específico para programas
const programRateLimit = rateLimit({
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
router.use(programRateLimit);

/**
 * @route   POST /api/programs
 * @desc    Crear un nuevo programa
 * @access  Private (Solo si tienes acceso al portfolio)
 * @body    { portfolio_id, name, description, status? }
 */
router.post('/',
    writeOperationsRateLimit,
    programValidations.validateCreate,
    programValidations.validateProgramName,
    programValidations.validateDescription,
    programValidations.sanitizeProgramData,
    programController.createProgram
);

/**
 * @route   GET /api/programs/:id
 * @desc    Obtener programa por ID
 * @access  Private (Según permisos del portfolio)
 * @param   id - ID del programa
 */
router.get('/:id',
    programValidations.validateProgramId,
    programController.getProgramById
);

/**
 * @route   PUT /api/programs/:id
 * @desc    Actualizar programa
 * @access  Private (Propietario del portfolio + Admin/Superadmin)
 * @param   id - ID del programa
 * @body    { name?, description?, status? }
 */
router.put('/:id',
    writeOperationsRateLimit,
    programValidations.validateProgramId,
    programValidations.validateUpdate,
    programValidations.validateProgramName,
    programValidations.validateDescription,
    programValidations.validateStatusTransition,
    programValidations.sanitizeProgramData,
    programController.updateProgram
);

/**
 * @route   PATCH /api/programs/:id/status
 * @desc    Cambiar estado del programa
 * @access  Private (Propietario del portfolio + Admin/Superadmin)
 * @param   id - ID del programa
 * @body    { status }
 */
router.patch('/:id/status',
    writeOperationsRateLimit,
    programValidations.validateProgramId,
    programValidations.validateChangeStatus,
    programValidations.validateStatusTransition,
    programValidations.sanitizeProgramData,
    programController.changeProgramStatus
);

/**
 * @route   DELETE /api/programs/:id
 * @desc    Eliminar programa
 * @access  Private (Propietario del portfolio + Superadmin)
 * @param   id - ID del programa
 */
router.delete('/:id',
    writeOperationsRateLimit,
    programValidations.validateProgramId,
    programController.deleteProgram
);

/**
 * @route   GET /api/programs/:id/stats
 * @desc    Obtener estadísticas del programa
 * @access  Private (Según permisos del portfolio)
 * @param   id - ID del programa
 */
router.get('/:id/stats',
    programValidations.validateProgramId,
    programController.getProgramStats
);

//RUTAS ANIDADAS A PROGRAMAS

/**
 * @route   GET /api/portfolios/:portfolioId/programs
 * @desc    Obtener programas de un portfolio específico
 * @access  Private (Según permisos del portfolio)
 * @param   portfolioId - ID del portfolio
 * @query   page, limit, search, status, include_projects
 */
router.get('/:portfolioId/programs',
    portfolioValidations.validatePortfolioId,
    programValidations.validateQueryParams,
    programController.getProgramsByPortfolio
);

/**
 * @route   POST /api/portfolios/:portfolioId/programs
 * @desc    Crear un nuevo programa en un portfolio específico
 * @access  Private (Solo si tienes acceso al portfolio)
 * @param   portfolioId - ID del portfolio
 * @body    { name, description, status? }
 */
router.post('/:portfolioId/programs',
    writeOperationsRateLimit,
    portfolioValidations.validatePortfolioId,
    programValidations.validateCreate,
    programValidations.validatePortfolioConsistency,
    programValidations.validateProgramName,
    programValidations.validateDescription,
    programValidations.sanitizeProgramData,
    programController.createProgram
);

// Middleware de manejo de errores específico para programas
router.use((error, req, res, next) => {
    console.error('Error en rutas de programas:', error);

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