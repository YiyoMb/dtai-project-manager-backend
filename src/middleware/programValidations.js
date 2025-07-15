const Joi = require('joi');
const { validate } = require('./validateMiddleware');

// Esquemas de validación para programas
const programSchemas = {
    // Esquema para crear programa
    create: Joi.object({
        portfolio_id: Joi.number()
            .integer()
            .positive()
            .required()
            .messages({
                'number.base': 'El ID del portfolio debe ser un número',
                'number.integer': 'El ID del portfolio debe ser un número entero',
                'number.positive': 'El ID del portfolio debe ser un número positivo',
                'any.required': 'El ID del portfolio es obligatorio'
            }),

        name: Joi.string()
            .trim()
            .min(2)
            .max(100)
            .required()
            .messages({
                'string.empty': 'El nombre del programa es obligatorio',
                'string.min': 'El nombre debe tener al menos 2 caracteres',
                'string.max': 'El nombre no puede exceder 100 caracteres',
                'any.required': 'El nombre del programa es obligatorio'
            }),

        description: Joi.string()
            .trim()
            .max(1000)
            .allow('', null)
            .optional()
            .messages({
                'string.max': 'La descripción no puede exceder 1000 caracteres'
            }),

        status: Joi.string()
            .valid('activo', 'pausado', 'completado', 'cancelado')
            .default('activo')
            .optional()
            .messages({
                'any.only': 'El estado debe ser: activo, pausado, completado o cancelado'
            })
    }),

    // Esquema para actualizar programa
    update: Joi.object({
        name: Joi.string()
            .trim()
            .min(2)
            .max(100)
            .optional()
            .messages({
                'string.empty': 'El nombre del programa no puede estar vacío',
                'string.min': 'El nombre debe tener al menos 2 caracteres',
                'string.max': 'El nombre no puede exceder 100 caracteres'
            }),

        description: Joi.string()
            .trim()
            .max(1000)
            .allow('', null)
            .optional()
            .messages({
                'string.max': 'La descripción no puede exceder 1000 caracteres'
            }),

        status: Joi.string()
            .valid('activo', 'pausado', 'completado', 'cancelado')
            .optional()
            .messages({
                'any.only': 'El estado debe ser: activo, pausado, completado o cancelado'
            })
    }).min(1).messages({
        'object.min': 'Debe proporcionar al menos un campo para actualizar'
    }),

    // Esquema para cambiar estado
    changeStatus: Joi.object({
        status: Joi.string()
            .valid('activo', 'pausado', 'completado', 'cancelado')
            .required()
            .messages({
                'any.only': 'El estado debe ser: activo, pausado, completado o cancelado',
                'any.required': 'El estado es obligatorio'
            })
    }),

    // Esquema para parámetros de ID de programa
    programId: Joi.object({
        id: Joi.number()
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

    // Esquema para parámetros de ID de portfolio
    portfolioId: Joi.object({
        portfolioId: Joi.number()
            .integer()
            .positive()
            .required()
            .messages({
                'number.base': 'El ID del portfolio debe ser un número',
                'number.integer': 'El ID del portfolio debe ser un número entero',
                'number.positive': 'El ID del portfolio debe ser un número positivo',
                'any.required': 'El ID del portfolio es obligatorio'
            })
    }),

    // Esquema para query parameters de listado de programas
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
            .valid('activo', 'pausado', 'completado', 'cancelado', '')
            .default('')
            .messages({
                'any.only': 'El filtro de estado debe ser: activo, pausado, completado o cancelado'
            }),

        include_projects: Joi.string()
            .valid('true', 'false')
            .default('false')
            .messages({
                'any.only': 'include_projects debe ser "true" o "false"'
            })
    })
};

// Middlewares de validación usando la función validate
const programValidations = {
    // Validar datos para crear programa
    validateCreate: validate(programSchemas.create, 'body'),

    // Validar datos para actualizar programa
    validateUpdate: validate(programSchemas.update, 'body'),

    // Validar cambio de estado
    validateChangeStatus: validate(programSchemas.changeStatus, 'body'),

    // Validar ID de programa en parámetros
    validateProgramId: validate(programSchemas.programId, 'params'),

    // Validar ID de portfolio en parámetros
    validatePortfolioId: validate(programSchemas.portfolioId, 'params'),

    // Validar parámetros de query para listado
    validateQueryParams: validate(programSchemas.queryParams, 'query')
};

// Validaciones personalizadas adicionales (middleware functions)
const customValidations = {
    /**
     * Validar que el nombre del programa no contenga caracteres especiales problemáticos
     */
    validateProgramName: (req, res, next) => {
        const { name } = req.body;

        if (name) {
            // Permitir letras, números, espacios, guiones y algunos caracteres especiales básicos
            const allowedPattern = /^[a-zA-Z0-9\s\-_().áéíóúÁÉÍÓÚñÑ]+$/;

            if (!allowedPattern.test(name.trim())) {
                return res.status(400).json({
                    success: false,
                    message: 'El nombre del programa contiene caracteres no permitidos',
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
                'activo': ['pausado', 'completado', 'cancelado'],
                'pausado': ['activo', 'completado', 'cancelado'],
                'completado': ['activo'], // Solo se puede reactivar un programa completado
                'cancelado': ['activo'] // Solo se puede reactivar un programa cancelado
            };

            // Esta validación se puede mejorar cuando tengamos el estado actual
            // Por ahora solo validamos que el estado sea válido (ya hecho en Joi)
        }

        next();
    },

    /**
     * Sanitizar y normalizar datos de entrada
     */
    sanitizeProgramData: (req, res, next) => {
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

        next();
    },

    /**
     * Validar que el portfolio_id es coherente con la URL (para rutas anidadas)
     */
    validatePortfolioConsistency: (req, res, next) => {
        const portfolioIdFromUrl = req.params.portfolioId;
        const portfolioIdFromBody = req.body.portfolio_id;

        // Solo aplicar esta validación si ambos están presentes
        if (portfolioIdFromUrl && portfolioIdFromBody) {
            if (parseInt(portfolioIdFromUrl) !== parseInt(portfolioIdFromBody)) {
                return res.status(400).json({
                    success: false,
                    message: 'El ID del portfolio en la URL no coincide con el del cuerpo de la petición',
                    code: 'PORTFOLIO_ID_MISMATCH'
                });
            }
        }

        // Si solo hay portfolioId en la URL, agregarlo al body para facilitar el procesamiento
        if (portfolioIdFromUrl && !portfolioIdFromBody) {
            req.body.portfolio_id = parseInt(portfolioIdFromUrl);
        }

        next();
    }
};

// Exportar todo
module.exports = {
    ...programValidations,
    ...customValidations,
    schemas: programSchemas
};