const logger = require('../utils/logger');

/**
 * Middleware para manejo centralizado de errores
 * @param {Error} err - Error object
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 */
const errorMiddleware = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Log del error
    logger.error('Error middleware:', {
        message: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userId: req.user?.id,
    });

    // Error de validación de Sequelize
    if (err.name === 'SequelizeValidationError') {
        const messages = err.errors.map(error => error.message);
        error = {
            message: 'Errores de validación',
            details: messages,
            statusCode: 400,
        };
    }

    // Error de constraint único de Sequelize
    if (err.name === 'SequelizeUniqueConstraintError') {
        const field = err.errors[0].path;
        error = {
            message: `El ${field} ya existe`,
            statusCode: 400,
        };
    }

    // Error de clave foránea de Sequelize
    if (err.name === 'SequelizeForeignKeyConstraintError') {
        error = {
            message: 'Error de referencia: el recurso relacionado no existe',
            statusCode: 400,
        };
    }

    // Error de conexión a la base de datos
    if (err.name === 'SequelizeConnectionError') {
        error = {
            message: 'Error de conexión a la base de datos',
            statusCode: 500,
        };
    }

    // Error de JWT
    if (err.name === 'JsonWebTokenError') {
        error = {
            message: 'Token inválido',
            statusCode: 401,
        };
    }

    // Error de token expirado
    if (err.name === 'TokenExpiredError') {
        error = {
            message: 'Token expirado',
            statusCode: 401,
        };
    }

    // Error de validación de Joi
    if (err.isJoi) {
        const messages = err.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
        }));
        error = {
            message: 'Errores de validación',
            details: messages,
            statusCode: 400,
        };
    }

    // Error personalizado con statusCode
    if (err.statusCode) {
        error.statusCode = err.statusCode;
    }

    // Error de sintaxis JSON
    if (err.type === 'entity.parse.failed') {
        error = {
            message: 'JSON inválido',
            statusCode: 400,
        };
    }

    // Error de archivo muy grande
    if (err.code === 'LIMIT_FILE_SIZE') {
        error = {
            message: 'Archivo muy grande',
            statusCode: 413,
        };
    }

    // Error de archivo no soportado
    if (err.code === 'UNSUPPORTED_FILE_TYPE') {
        error = {
            message: 'Tipo de archivo no soportado',
            statusCode: 400,
        };
    }

    // Error 404 personalizado
    if (err.code === 'RESOURCE_NOT_FOUND') {
        error = {
            message: 'Recurso no encontrado',
            statusCode: 404,
        };
    }

    // Error 403 personalizado
    if (err.code === 'ACCESS_DENIED') {
        error = {
            message: 'Acceso denegado',
            statusCode: 403,
        };
    }

    // Error de rate limiting
    if (err.code === 'RATE_LIMIT_EXCEEDED') {
        error = {
            message: 'Demasiadas peticiones, intenta más tarde',
            statusCode: 429,
        };
    }

    // Definir código de estado por defecto
    const statusCode = error.statusCode || 500;

    // Respuesta de error
    const errorResponse = {
        success: false,
        error: error.message || 'Error interno del servidor',
        code: err.code || 'INTERNAL_SERVER_ERROR',
        ...(error.details && { details: error.details }),
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    };

    // Agregar información adicional en desarrollo
    if (process.env.NODE_ENV === 'development') {
        errorResponse.originalError = err.name;
        errorResponse.timestamp = new Date().toISOString();
        errorResponse.path = req.originalUrl;
        errorResponse.method = req.method;
    }

    res.status(statusCode).json(errorResponse);
};

/**
 * Middleware para manejar rutas no encontradas
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware
 */
const notFoundMiddleware = (req, res, next) => {
    const error = new Error(`Ruta no encontrada: ${req.originalUrl}`);
    error.statusCode = 404;
    error.code = 'ROUTE_NOT_FOUND';
    next(error);
};

/**
 * Wrapper para controladores async
 * @param {Function} fn - Función async del controlador
 * @returns {Function} Función wrapped
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Crear error personalizado
 * @param {string} message - Mensaje del error
 * @param {number} statusCode - Código de estado HTTP
 * @param {string} code - Código de error personalizado
 * @returns {Error} Error personalizado
 */
const createError = (message, statusCode = 500, code = 'CUSTOM_ERROR') => {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    return error;
};

module.exports = {
    errorMiddleware,
    notFoundMiddleware,
    asyncHandler,
    createError,
};