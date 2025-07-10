const Joi = require('joi');
const logger = require('../utils/logger');

/**
 * Middleware para validar datos usando Joi
 * @param {Object} schema - Esquema de validación de Joi
 * @param {string} property - Propiedad del request a validar ('body', 'params', 'query')
 * @returns {Function} Middleware function
 */
const validate = (schema, property = 'body') => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[property], {
            abortEarly: false,
            allowUnknown: false,
            stripUnknown: true,
        });

        if (error) {
            const errorDetails = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context.value,
            }));

            logger.warn('Validation error:', { errors: errorDetails, property });

            return res.status(400).json({
                error: 'Datos de entrada inválidos',
                code: 'VALIDATION_ERROR',
                details: errorDetails,
            });
        }

        // Reemplazar los datos originales con los datos validados y sanitizados
        req[property] = value;
        next();
    };
};

/**
 * Esquemas de validación para autenticación
 */
const authSchemas = {
    // Esquema para registro
    register: Joi.object({
        name: Joi.string()
            .min(2)
            .max(100)
            .trim()
            .required()
            .messages({
                'string.min': 'El nombre debe tener al menos 2 caracteres',
                'string.max': 'El nombre no debe exceder 100 caracteres',
                'any.required': 'El nombre es requerido',
            }),
        email: Joi.string()
            .email()
            .max(255)
            .lowercase()
            .trim()
            .required()
            .messages({
                'string.email': 'Debe ser un email válido',
                'string.max': 'El email no debe exceder 255 caracteres',
                'any.required': 'El email es requerido',
            }),
        password: Joi.string()
            .min(8)
            .max(100)
            .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\\$%\\^&\\*])'))
            .required()
            .messages({
                'string.min': 'La contraseña debe tener al menos 8 caracteres',
                'string.max': 'La contraseña no debe exceder 100 caracteres',
                'string.pattern.base': 'La contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial',
                'any.required': 'La contraseña es requerida',
            }),
        role_id: Joi.number()
            .integer()
            .positive()
            .required()
            .messages({
                'number.base': 'El ID del rol debe ser un número',
                'number.integer': 'El ID del rol debe ser un entero',
                'number.positive': 'El ID del rol debe ser positivo',
                'any.required': 'El ID del rol es requerido',
            }),
    }),

    // Esquema para login
    login: Joi.object({
        email: Joi.string()
            .email()
            .max(255)
            .lowercase()
            .trim()
            .required()
            .messages({
                'string.email': 'Debe ser un email válido',
                'any.required': 'El email es requerido',
            }),
        password: Joi.string()
            .min(1)
            .max(100)
            .required()
            .messages({
                'string.min': 'La contraseña es requerida',
                'any.required': 'La contraseña es requerida',
            }),
    }),

    // Esquema para refresh token
    refreshToken: Joi.object({
        refreshToken: Joi.string()
            .required()
            .messages({
                'any.required': 'El token de refresco es requerido',
            }),
    }),

    // Esquema para solicitud de reset de contraseña
    forgotPassword: Joi.object({
        email: Joi.string()
            .email()
            .max(255)
            .lowercase()
            .trim()
            .required()
            .messages({
                'string.email': 'Debe ser un email válido',
                'any.required': 'El email es requerido',
            }),
    }),

    // Esquema para reset de contraseña
    resetPassword: Joi.object({
        token: Joi.string()
            .required()
            .messages({
                'any.required': 'El token es requerido',
            }),
        password: Joi.string()
            .min(8)
            .max(100)
            .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\\$%\\^&\\*])'))
            .required()
            .messages({
                'string.min': 'La contraseña debe tener al menos 8 caracteres',
                'string.max': 'La contraseña no debe exceder 100 caracteres',
                'string.pattern.base': 'La contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial',
                'any.required': 'La contraseña es requerida',
            }),
    }),

    // Esquema para cambio de contraseña
    changePassword: Joi.object({
        currentPassword: Joi.string()
            .required()
            .messages({
                'any.required': 'La contraseña actual es requerida',
            }),
        newPassword: Joi.string()
            .min(8)
            .max(100)
            .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\\$%\\^&\\*])'))
            .required()
            .messages({
                'string.min': 'La nueva contraseña debe tener al menos 8 caracteres',
                'string.max': 'La nueva contraseña no debe exceder 100 caracteres',
                'string.pattern.base': 'La nueva contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial',
                'any.required': 'La nueva contraseña es requerida',
            }),
    }),

    // Esquema para actualización de perfil
    updateProfile: Joi.object({
        name: Joi.string()
            .min(2)
            .max(100)
            .trim()
            .optional()
            .messages({
                'string.min': 'El nombre debe tener al menos 2 caracteres',
                'string.max': 'El nombre no debe exceder 100 caracteres',
            }),
    }),
};

/**
 * Esquemas de validación para usuarios
 */
const userSchemas = {
    // Esquema para crear usuario
    createUser: Joi.object({
        name: Joi.string()
            .min(2)
            .max(100)
            .trim()
            .required()
            .messages({
                'string.min': 'El nombre debe tener al menos 2 caracteres',
                'string.max': 'El nombre no debe exceder 100 caracteres',
                'any.required': 'El nombre es requerido',
            }),
        email: Joi.string()
            .email()
            .max(255)
            .lowercase()
            .trim()
            .required()
            .messages({
                'string.email': 'Debe ser un email válido',
                'string.max': 'El email no debe exceder 255 caracteres',
                'any.required': 'El email es requerido',
            }),
        password: Joi.string()
            .min(8)
            .max(100)
            .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\\$%\\^&\\*])'))
            .required()
            .messages({
                'string.min': 'La contraseña debe tener al menos 8 caracteres',
                'string.max': 'La contraseña no debe exceder 100 caracteres',
                'string.pattern.base': 'La contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial',
                'any.required': 'La contraseña es requerida',
            }),
        role_id: Joi.number()
            .integer()
            .positive()
            .required()
            .messages({
                'number.base': 'El ID del rol debe ser un número',
                'number.integer': 'El ID del rol debe ser un entero',
                'number.positive': 'El ID del rol debe ser positivo',
                'any.required': 'El ID del rol es requerido',
            }),
    }),

    // Esquema para actualizar usuario
    updateUser: Joi.object({
        name: Joi.string()
            .min(2)
            .max(100)
            .trim()
            .optional()
            .messages({
                'string.min': 'El nombre debe tener al menos 2 caracteres',
                'string.max': 'El nombre no debe exceder 100 caracteres',
            }),
        email: Joi.string()
            .email()
            .max(255)
            .lowercase()
            .trim()
            .optional()
            .messages({
                'string.email': 'Debe ser un email válido',
                'string.max': 'El email no debe exceder 255 caracteres',
            }),
        role_id: Joi.number()
            .integer()
            .positive()
            .optional()
            .messages({
                'number.base': 'El ID del rol debe ser un número',
                'number.integer': 'El ID del rol debe ser un entero',
                'number.positive': 'El ID del rol debe ser positivo',
            }),
        is_active: Joi.boolean()
            .optional()
            .messages({
                'boolean.base': 'El estado debe ser verdadero o falso',
            }),
    }),

    // Esquema para cambiar estado de usuario
    changeUserStatus: Joi.object({
        is_active: Joi.boolean()
            .required()
            .messages({
                'boolean.base': 'El estado debe ser verdadero o falso',
                'any.required': 'El estado es requerido',
            }),
    }),

    // Esquema para cambiar rol de usuario
    changeUserRole: Joi.object({
        role_id: Joi.number()
            .integer()
            .positive()
            .required()
            .messages({
                'number.base': 'El ID del rol debe ser un número',
                'number.integer': 'El ID del rol debe ser un entero',
                'number.positive': 'El ID del rol debe ser positivo',
                'any.required': 'El ID del rol es requerido',
            }),
    }),
};

/**
 * Esquemas de validación para parámetros de URL
 */
const paramSchemas = {
    // Esquema para ID numérico
    id: Joi.object({
        id: Joi.number()
            .integer()
            .positive()
            .required()
            .messages({
                'number.base': 'El ID debe ser un número',
                'number.integer': 'El ID debe ser un entero',
                'number.positive': 'El ID debe ser positivo',
                'any.required': 'El ID es requerido',
            }),
    }),

    // Esquema para user ID
    userId: Joi.object({
        userId: Joi.number()
            .integer()
            .positive()
            .required()
            .messages({
                'number.base': 'El ID del usuario debe ser un número',
                'number.integer': 'El ID del usuario debe ser un entero',
                'number.positive': 'El ID del usuario debe ser positivo',
                'any.required': 'El ID del usuario es requerido',
            }),
    }),

    // Esquema para token
    token: Joi.object({
        token: Joi.string()
            .required()
            .messages({
                'any.required': 'El token es requerido',
            }),
    }),
};

/**
 * Esquemas de validación para query parameters
 */
const querySchemas = {
    // Esquema para paginación
    pagination: Joi.object({
        page: Joi.number()
            .integer()
            .min(1)
            .default(1)
            .messages({
                'number.base': 'La página debe ser un número',
                'number.integer': 'La página debe ser un entero',
                'number.min': 'La página debe ser mayor a 0',
            }),
        limit: Joi.number()
            .integer()
            .min(1)
            .max(100)
            .default(10)
            .messages({
                'number.base': 'El límite debe ser un número',
                'number.integer': 'El límite debe ser un entero',
                'number.min': 'El límite debe ser mayor a 0',
                'number.max': 'El límite no debe exceder 100',
            }),
        sortBy: Joi.string()
            .valid('id', 'name', 'email', 'created_at', 'updated_at')
            .default('created_at')
            .messages({
                'any.only': 'El campo de ordenamiento no es válido',
            }),
        sortOrder: Joi.string()
            .valid('ASC', 'DESC', 'asc', 'desc')
            .default('DESC')
            .messages({
                'any.only': 'El orden debe ser ASC o DESC',
            }),
    }),

    // Esquema para filtros de usuarios
    userFilters: Joi.object({
        name: Joi.string()
            .max(100)
            .optional()
            .messages({
                'string.max': 'El filtro de nombre no debe exceder 100 caracteres',
            }),
        email: Joi.string()
            .email()
            .max(255)
            .optional()
            .messages({
                'string.email': 'El filtro de email debe ser válido',
                'string.max': 'El filtro de email no debe exceder 255 caracteres',
            }),
        role_id: Joi.number()
            .integer()
            .positive()
            .optional()
            .messages({
                'number.base': 'El filtro de rol debe ser un número',
                'number.integer': 'El filtro de rol debe ser un entero',
                'number.positive': 'El filtro de rol debe ser positivo',
            }),
        is_active: Joi.boolean()
            .optional()
            .messages({
                'boolean.base': 'El filtro de estado debe ser verdadero o falso',
            }),
    }),
};

module.exports = {
    validate,
    authSchemas,
    userSchemas,
    paramSchemas,
    querySchemas,
};