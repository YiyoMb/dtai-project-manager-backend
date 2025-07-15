const Joi = require('joi');
const { validate } = require('./validateMiddleware');

// Esquemas de validación para proyectos
const projectSchemas = {
    // Esquema para crear proyecto
    create: Joi.object({
        program_id: Joi.number()
            .integer()
            .positive()
            .required()
            .messages({
                'number.base': 'El ID del programa debe ser un número',
                'number.integer': 'El ID del programa debe ser un número entero',
                'number.positive': 'El ID del programa debe ser un número positivo',
                'any.required': 'El ID del programa es obligatorio'
            }),

        name: Joi.string()
            .trim()
            .min(2)
            .max(100)
            .required()
            .messages({
                'string.empty': 'El nombre del proyecto es obligatorio',
                'string.min': 'El nombre debe tener al menos 2 caracteres',
                'string.max': 'El nombre no puede exceder 100 caracteres',
                'any.required': 'El nombre del proyecto es obligatorio'
            }),

        description: Joi.string()
            .trim()
            .max(2000)
            .allow('', null)
            .optional()
            .messages({
                'string.max': 'La descripción no puede exceder 2000 caracteres'
            }),

        status: Joi.string()
            .valid('pendiente', 'en_proceso', 'completado', 'cancelado')
            .default('pendiente')
            .optional()
            .messages({
                'any.only': 'El estado debe ser: pendiente, en_proceso, completado o cancelado'
            }),

        risk_level: Joi.string()
            .valid('bajo', 'medio', 'alto', 'critico')
            .default('bajo')
            .optional()
            .messages({
                'any.only': 'El nivel de riesgo debe ser: bajo, medio, alto o critico'
            })
    }),

    // Esquema para actualizar proyecto
    update: Joi.object({
        program_id: Joi.number()
            .integer()
            .positive()
            .optional()
            .messages({
                'number.base': 'El ID del programa debe ser un número',
                'number.integer': 'El ID del programa debe ser un número entero',
                'number.positive': 'El ID del programa debe ser un número positivo'
            }),

        name: Joi.string()
            .trim()
            .min(2)
            .max(100)
            .optional()
            .messages({
                'string.empty': 'El nombre del proyecto no puede estar vacío',
                'string.min': 'El nombre debe tener al menos 2 caracteres',
                'string.max': 'El nombre no puede exceder 100 caracteres'
            }),

        description: Joi.string()
            .trim()
            .max(2000)
            .allow('', null)
            .optional()
            .messages({
                'string.max': 'La descripción no puede exceder 2000 caracteres'
            }),

        status: Joi.string()
            .valid('pendiente', 'en_proceso', 'completado', 'cancelado')
            .optional()
            .messages({
                'any.only': 'El estado debe ser: pendiente, en_proceso, completado o cancelado'
            }),

        risk_level: Joi.string()
            .valid('bajo', 'medio', 'alto', 'critico')
            .optional()
            .messages({
                'any.only': 'El nivel de riesgo debe ser: bajo, medio, alto o critico'
            })
    }).min(1).messages({
        'object.min': 'Debe proporcionar al menos un campo para actualizar'
    }),

    // Esquema para cambiar estado
    changeStatus: Joi.object({
        status: Joi.string()
            .valid('pendiente', 'en_proceso', 'completado', 'cancelado')
            .required()
            .messages({
                'any.only': 'El estado debe ser: pendiente, en_proceso, completado o cancelado',
                'any.required': 'El estado es obligatorio'
            })
    }),

    // Esquema para parámetros de ID de proyecto
    projectId: Joi.object({
        id: Joi.number()
            .integer()
            .positive()
            .required()
            .messages({
                'number.base': 'El ID del proyecto debe ser un número',
                'number.integer': 'El ID del proyecto debe ser un número entero',
                'number.positive': 'El ID del proyecto debe ser un número positivo',
                'any.required': 'El ID del proyecto es obligatorio'
            })
    }),

    // Esquema para parámetros de ID de programa
    programId: Joi.object({
        programId: Joi.number()
            .integer()
            .positive()
            .required()
            .messages({
                'number.base': 'El ID del programa debe ser un número',
                'number.integer': 'El ID del programa debe ser un número entero',
                'number.positive': 'El ID del programa debe ser un número positivo',
                'any.required': 'El ID del programa es obligatorio'
            })
    }),

    // Esquema para parámetros de nivel de riesgo
    riskLevel: Joi.object({
        riskLevel: Joi.string()
            .valid('bajo', 'medio', 'alto', 'critico')
            .required()
            .messages({
                'any.only': 'El nivel de riesgo debe ser: bajo, medio, alto o critico',
                'any.required': 'El nivel de riesgo es obligatorio'
            })
    }),

    // Esquema para query parameters de listado de proyectos
    queryParams: Joi.object({
        page: Joi.number()
            .integer()
            .min(1)
            .default(1)
            .messages({
                'number.base': 'La página debe ser un número',
                'number.integer': 'La página debe ser un número entero',
                'number.min': 'La página debe ser mayor a 0'
            }),

        limit: Joi.number()
            .integer()
            .min(1)
            .max(100)
            .default(10)
            .messages({
                'number.base': 'El límite debe ser un número',
                'number.integer': 'El límite debe ser un número entero',
                'number.min': 'El límite debe ser mayor a 0',
                'number.max': 'El límite no puede ser mayor a 100'
            }),

        search: Joi.string()
            .trim()
            .max(255)
            .allow('')
            .default('')
            .messages({
                'string.max': 'El término de búsqueda no puede exceder 255 caracteres'
            }),

        status: Joi.string()
            .valid('pendiente', 'en_proceso', 'completado', 'cancelado', '')
            .default('')
            .messages({
                'any.only': 'El filtro de estado debe ser: pendiente, en_proceso, completado o cancelado'
            }),

        risk_level: Joi.string()
            .valid('bajo', 'medio', 'alto', 'critico', '')
            .default('')
            .messages({
                'any.only': 'El filtro de riesgo debe ser: bajo, medio, alto o critico'
            }),

        program_id: Joi.number()
            .integer()
            .positive()
            .optional()
            .messages({
                'number.base': 'El ID del programa debe ser un número',
                'number.integer': 'El ID del programa debe ser un número entero',
                'number.positive': 'El ID del programa debe ser un número positivo'
            }),

        created_by: Joi.number()
            .integer()
            .positive()
            .optional()
            .messages({
                'number.base': 'El ID del creador debe ser un número',
                'number.integer': 'El ID del creador debe ser un número entero',
                'number.positive': 'El ID del creador debe ser un número positivo'
            }),

        sortBy: Joi.string()
            .valid('name', 'status', 'risk_level', 'created_at')
            .default('created_at')
            .messages({
                'any.only': 'El campo de ordenamiento debe ser: name, status, risk_level o created_at'
            }),

        sortOrder: Joi.string()
            .valid('ASC', 'DESC')
            .default('DESC')
            .messages({
                'any.only': 'El orden debe ser ASC o DESC'
            }),

        includeDetails: Joi.string()
            .valid('true', 'false')
            .default('false')
            .messages({
                'any.only': 'includeDetails debe ser "true" o "false"'
            })
    }),

    // Esquema para parámetros del dashboard
    dashboardParams: Joi.object({
        program_id: Joi.number()
            .integer()
            .positive()
            .optional()
            .messages({
                'number.base': 'El ID del programa debe ser un número',
                'number.integer': 'El ID del programa debe ser un número entero',
                'number.positive': 'El ID del programa debe ser un número positivo'
            }),

        portfolio_id: Joi.number()
            .integer()
            .positive()
            .optional()
            .messages({
                'number.base': 'El ID del portfolio debe ser un número',
                'number.integer': 'El ID del portfolio debe ser un número entero',
                'number.positive': 'El ID del portfolio debe ser un número positivo'
            })
    })
};

// Middlewares de validación usando la función validate
const projectValidations = {
    // Validar datos para crear proyecto
    validateCreate: validate(projectSchemas.create, 'body'),

    // Validar datos para actualizar proyecto
    validateUpdate: validate(projectSchemas.update, 'body'),

    // Validar cambio de estado
    validateChangeStatus: validate(projectSchemas.changeStatus, 'body'),

    // Validar ID de proyecto en parámetros
    validateProjectId: validate(projectSchemas.projectId, 'params'),

    // Validar ID de programa en parámetros
    validateProgramId: validate(projectSchemas.programId, 'params'),

    // Validar nivel de riesgo en parámetros
    validateRiskLevel: validate(projectSchemas.riskLevel, 'params'),

    // Validar parámetros de query para listado
    validateQueryParams: validate(projectSchemas.queryParams, 'query'),

    // Validar parámetros del dashboard
    validateDashboardParams: validate(projectSchemas.dashboardParams, 'query')
};

// Validaciones personalizadas adicionales (middleware functions)
const customValidations = {
    /**
     * Validar que el nombre del proyecto no contenga caracteres especiales problemáticos
     */
    validateProjectName: (req, res, next) => {
        const { name } = req.body;

        if (name) {
            // Permitir letras, números, espacios, guiones y algunos caracteres especiales básicos
            const allowedPattern = /^[a-zA-Z0-9\s\-_().áéíóúÁÉÍÓÚñÑ]+$/;

            if (!allowedPattern.test(name.trim())) {
                return res.status(400).json({
                    success: false,
                    message: 'El nombre del proyecto contiene caracteres no permitidos',
                    code: 'INVALID_CHARACTERS',
                    details: 'Solo se permiten letras, números, espacios, guiones y paréntesis'
                });
            }
        }

        next();
    },

    /**
     * Validar longitud mínima de descripción si se proporciona
     */
    validateDescription: (req, res, next) => {
        const { description } = req.body;

        if (description && description.trim().length > 0 && description.trim().length < 5) {
            return res.status(400).json({
                success: false,
                message: 'La descripción debe tener al menos 5 caracteres si se proporciona',
                code: 'DESCRIPTION_TOO_SHORT'
            });
        }

        next();
    },

    /**
     * Validar transiciones de estado válidas
     */
    validateStatusTransition: (req, res, next) => {
        const { status } = req.body;

        if (status) {
            // Definir transiciones válidas de estado
            const validTransitions = {
                'pendiente': ['en_proceso', 'cancelado'],
                'en_proceso': ['completado', 'cancelado'],
                'completado': [], // No se puede cambiar desde completado
                'cancelado': ['pendiente'] // Solo se puede reactivar
            };

            // Esta validación se puede mejorar cuando tengamos el estado actual
            // Por ahora solo validamos que el estado sea válido (ya hecho en Joi)
            // La validación completa se hace en el service layer
        }

        next();
    },

    /**
     * Validar coherencia del nivel de riesgo con el estado
     */
    validateRiskCoherence: (req, res, next) => {
        const { status, risk_level } = req.body;

        // Si el proyecto está completado, no debería tener riesgo crítico
        if (status === 'completado' && risk_level === 'critico') {
            return res.status(400).json({
                success: false,
                message: 'Un proyecto completado no puede tener riesgo crítico',
                code: 'INVALID_RISK_STATUS_COMBINATION'
            });
        }

        // Si el proyecto está cancelado, el riesgo no es relevante
        if (status === 'cancelado' && risk_level && risk_level !== 'bajo') {
            return res.status(400).json({
                success: false,
                message: 'Un proyecto cancelado debería tener riesgo bajo',
                code: 'INVALID_RISK_STATUS_COMBINATION'
            });
        }

        next();
    },

    /**
     * Sanitizar y normalizar datos de entrada
     */
    sanitizeProjectData: (req, res, next) => {
        if (req.body.name) {
            // Normalizar espacios múltiples a uno solo
            req.body.name = req.body.name.trim().replace(/\s+/g, ' ');
        }

        if (req.body.description) {
            // Normalizar espacios y saltos de línea
            req.body.description = req.body.description.trim().replace(/\s+/g, ' ');

            // Convertir cadena vacía a null
            if (req.body.description === '') {
                req.body.description = null;
            }
        }

        // Normalizar status a lowercase
        if (req.body.status) {
            req.body.status = req.body.status.toLowerCase().trim();
        }

        // Normalizar risk_level a lowercase
        if (req.body.risk_level) {
            req.body.risk_level = req.body.risk_level.toLowerCase().trim();
        }

        next();
    },

    /**
     * Validar que el program_id es coherente con la URL (para rutas anidadas)
     */
    validateProgramConsistency: (req, res, next) => {
        const programIdFromUrl = req.params.programId;
        const programIdFromBody = req.body.program_id;

        // Solo aplicar esta validación si ambos están presentes
        if (programIdFromUrl && programIdFromBody) {
            if (parseInt(programIdFromUrl) !== parseInt(programIdFromBody)) {
                return res.status(400).json({
                    success: false,
                    message: 'El ID del programa en la URL no coincide con el del cuerpo de la petición',
                    code: 'PROGRAM_ID_MISMATCH'
                });
            }
        }

        // Si solo hay programId en la URL, agregarlo al body para facilitar el procesamiento
        if (programIdFromUrl && !programIdFromBody) {
            req.body.program_id = parseInt(programIdFromUrl);
        }

        next();
    },

    /**
     * Validar que el nivel de riesgo es apropiado para el tipo de proyecto
     */
    validateRiskLevelContext: (req, res, next) => {
        const { risk_level, name } = req.body;

        if (risk_level && name) {
            // Proyectos de prototipo o prueba deberían tener riesgo bajo por defecto
            const lowRiskKeywords = ['prueba', 'test', 'demo', 'prototipo', 'poc', 'ejemplo'];
            const isLowRiskProject = lowRiskKeywords.some(keyword =>
                name.toLowerCase().includes(keyword)
            );

            if (isLowRiskProject && ['alto', 'critico'].includes(risk_level)) {
                return res.status(400).json({
                    success: false,
                    message: 'Los proyectos de prueba o prototipo típicamente tienen riesgo bajo',
                    code: 'INAPPROPRIATE_RISK_LEVEL',
                    suggestion: 'Considere usar riesgo "bajo" o "medio" para este tipo de proyecto'
                });
            }
        }

        next();
    }
};

// Exportar todo
module.exports = {
    ...projectValidations,
    ...customValidations,
    schemas: projectSchemas
};