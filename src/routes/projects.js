const express = require('express');
const router = express.Router();

// Middlewares
const authMiddleware = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const rateLimit = require('express-rate-limit');

// Controlador y validaciones
const projectController = require('../controllers/projectController');
const projectValidations = require('../middleware/projectValidations');
const programValidations = require('../middleware/programValidations');

// Rate limiting específico para proyectos
const projectRateLimit = rateLimit({
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
router.use(projectRateLimit);

/**
 * @route   POST /api/projects
 * @desc    Crear un nuevo proyecto
 * @access  Private (Solo si tienes acceso al programa)
 * @body    { program_id, name, description, status?, risk_level? }
 */
router.post('/',
    writeOperationsRateLimit,
    projectValidations.validateCreate,
    projectValidations.validateProjectName,
    projectValidations.validateDescription,
    projectValidations.sanitizeProjectData,
    projectController.createProject
);

/**
 * @route   GET /api/projects/:id
 * @desc    Obtener proyecto por ID
 * @access  Private (Según permisos del programa)
 * @param   id - ID del proyecto
 */
router.get('/:id',
    projectValidations.validateProjectId,
    projectController.getProjectById
);

/**
 * @route   PUT /api/projects/:id
 * @desc    Actualizar proyecto
 * @access  Private (Propietario del programa + Admin/Superadmin)
 * @param   id - ID del proyecto
 * @body    { name?, description?, status?, risk_level? }
 */
router.put('/:id',
    writeOperationsRateLimit,
    projectValidations.validateProjectId,
    projectValidations.validateUpdate,
    projectValidations.validateProjectName,
    projectValidations.validateDescription,
    projectValidations.validateStatusTransition,
    projectValidations.sanitizeProjectData,
    projectController.updateProject
);

/**
 * @route   PATCH /api/projects/:id/status
 * @desc    Cambiar estado del proyecto
 * @access  Private (Propietario del programa + Admin/Superadmin)
 * @param   id - ID del proyecto
 * @body    { status }
 */
router.patch('/:id/status',
    writeOperationsRateLimit,
    projectValidations.validateProjectId,
    projectValidations.validateChangeStatus,
    projectValidations.validateStatusTransition,
    projectValidations.sanitizeProjectData,
    projectController.changeProjectStatus
);

/**
 * @route   DELETE /api/projects/:id
 * @desc    Eliminar proyecto
 * @access  Private (Propietario del programa + Superadmin)
 * @param   id - ID del proyecto
 */
router.delete('/:id',
    writeOperationsRateLimit,
    projectValidations.validateProjectId,
    projectController.deleteProject
);

/**
 * @route   GET /api/projects/:id/stats
 * @desc    Obtener estadísticas del proyecto
 * @access  Private (Según permisos del programa)
 * @param   id - ID del proyecto
 */
router.get('/:id/stats',
    projectValidations.validateProjectId,
    projectController.getProjectStats
);

// ===== RUTAS ESPECIALIZADAS =====

/**
 * @route   GET /api/projects/dashboard
 * @desc    Obtener dashboard de proyectos con estadísticas
 * @access  Private (Administradores y Líderes de Proyecto)
 * @query   program_id?, portfolio_id?
 */
router.get('/dashboard',
    projectValidations.validateDashboardParams,
    projectController.getProjectsDashboard
);

/**
 * @route   GET /api/projects/high-risk
 * @desc    Obtener proyectos de alto riesgo
 * @access  Private (Administradores y Líderes de Proyecto)
 * @query   program_id?
 */
router.get('/high-risk',
    projectValidations.validateQueryParams,
    projectController.getHighRiskProjects
);

/**
 * @route   GET /api/projects/risk/:riskLevel
 * @desc    Obtener proyectos por nivel de riesgo
 * @access  Private (Administradores y Líderes de Proyecto)
 * @param   riskLevel - Nivel de riesgo (bajo, medio, alto, critico)
 * @query   limit?
 */
router.get('/risk/:riskLevel',
    projectValidations.validateRiskLevel,
    projectValidations.validateQueryParams,
    projectController.getProjectsByRiskLevel
);

// ===== RUTAS ANIDADAS A PROGRAMAS =====

/**
 * @route   GET /api/programs/:programId/projects
 * @desc    Obtener proyectos de un programa específico
 * @access  Private (Según permisos del programa)
 * @param   programId - ID del programa
 * @query   page, limit, search, status, risk_level, include_details
 */
router.get('/:programId/projects',
    programValidations.validateProgramId,
    projectValidations.validateQueryParams,
    projectController.getProjectsByProgram
);

/**
 * @route   POST /api/programs/:programId/projects
 * @desc    Crear un nuevo proyecto en un programa específico
 * @access  Private (Solo si tienes acceso al programa)
 * @param   programId - ID del programa
 * @body    { name, description, status?, risk_level? }
 */
router.post('/:programId/projects',
    writeOperationsRateLimit,
    programValidations.validateProgramId,
    projectValidations.validateCreate,
    projectValidations.validateProgramConsistency,
    projectValidations.validateProjectName,
    projectValidations.validateDescription,
    projectValidations.sanitizeProjectData,
    projectController.createProject
);

/**
 * @route   GET /api/programs/:programId/projects/stats
 * @desc    Obtener estadísticas de proyectos por programa
 * @access  Private (Según permisos del programa)
 * @param   programId - ID del programa
 */
router.get('/:programId/projects/stats',
    programValidations.validateProgramId,
    projectController.getProjectStatsByProgram
);

// ===== RUTAS DE CONSULTA GENERAL =====

/**
 * @route   GET /api/projects
 * @desc    Obtener todos los proyectos con filtros
 * @access  Private (Todos los usuarios autenticados)
 * @query   page, limit, search, status, risk_level, program_id, created_by, sortBy, sortOrder
 */
router.get('/',
    projectValidations.validateQueryParams,
    projectController.getAllProjects
);

// Middleware de manejo de errores específico para proyectos
router.use((error, req, res, next) => {
    console.error('Error en rutas de proyectos:', error);

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