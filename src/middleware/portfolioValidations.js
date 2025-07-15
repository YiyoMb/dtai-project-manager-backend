const Joi = require('joi');
const { validate } = require('./validateMiddleware');

// Esquemas de validación para portfolios
const portfolioSchemas = {
    // Esquema para crear portfolio
    create: Joi.object({
        name: Joi.string()
            .trim()
            .min(2)
            .max(100)
            .required()
            .messages({
                'string.empty': 'El nombre del portfolio es obligatorio',
                'string.min': 'El nombre debe tener al menos 2 caracteres',
                'string.max': 'El nombre no puede exceder 100 caracteres',
                'any.required': 'El nombre del portfolio es obligatorio'
            }),

        description: Joi.string()
            .trim()
            .max(1000)
            .allow('', null)
            .optional()
            .messages({
                'string.max': 'La descripción no puede exceder 1000 caracteres'
            })
    }),

    // Esquema para actualizar portfolio
    update: Joi.object({
        name: Joi.string()
            .trim()
            .min(2)
            .max(100)
            .optional()
            .messages({
                'string.empty': 'El nombre del portfolio no puede estar vacío',
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
            })
    }).min(1).messages({
        'object.min': 'Debe proporcionar al menos un campo para actualizar'
    }),

    // Esquema para parámetros de ID
    portfolioId: Joi.object({
        id: Joi.number()
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

    // Esquema para query parameters de listado
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

        include_programs: Joi.string()
            .valid('true', 'false')
            .default('false')
            .messages({
                'any.only': 'include_programs debe ser "true" o "false"'
            })
    })
};

// Middlewares de validación usando tu función validate
const portfolioValidations = {
    // Validar datos para crear portfolio
    validateCreate: validate(portfolioSchemas.create, 'body'),

    // Validar datos para actualizar portfolio
    validateUpdate: validate(portfolioSchemas.update, 'body'),

    // Validar ID de portfolio en parámetros
    validatePortfolioId: validate(portfolioSchemas.portfolioId, 'params'),

    // Validar parámetros de query para listado
    validateQueryParams: validate(portfolioSchemas.queryParams, 'query')
};

// Validaciones personalizadas adicionales (middleware functions)
const customValidations = {
    /**
     * Validar que el nombre del portfolio no contenga caracteres especiales problemáticos
     */
    validatePortfolioName: (req, res, next) => {
        const { name } = req.body;

        if (name) {
            // Permitir letras, números, espacios, guiones y algunos caracteres especiales básicos
            const allowedPattern = /^[a-zA-Z0-9\s\-_().áéíóúÁÉÍÓÚñÑ]+$/;

            if (!allowedPattern.test(name.trim())) {
                return res.status(400).json({
                    success: false,
                    message: 'El nombre del portfolio contiene caracteres no permitidos',
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
     * Sanitizar y normalizar datos de entrada
     */
    sanitizePortfolioData: (req, res, next) => {
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

        next();
    }
};

// Exportar todo
module.exports = {
    ...portfolioValidations,
    ...customValidations,
    schemas: portfolioSchemas
};