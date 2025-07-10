const winston = require('winston');
const path = require('path');

// Configurar formato de logs
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Configurar formato para consola
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
        }
        return msg;
    })
);

// Crear directorio de logs si no existe
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Configurar transportes
const transports = [
    // Logs de error
    new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        level: 'error',
        format: logFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
    }),

    // Logs generales
    new winston.transports.File({
        filename: path.join(logsDir, 'combined.log'),
        format: logFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5,
    }),
];

// Agregar consola en desarrollo
if (process.env.NODE_ENV !== 'production') {
    transports.push(new winston.transports.Console({
        format: consoleFormat,
    }));
}

// Crear logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports,
    exitOnError: false,
});

// Función para logs de autenticación
logger.auth = (message, meta = {}) => {
    logger.info(`[AUTH] ${message}`, meta);
};

// Función para logs de base de datos
logger.db = (message, meta = {}) => {
    logger.info(`[DB] ${message}`, meta);
};

// Función para logs de API
logger.api = (message, meta = {}) => {
    logger.info(`[API] ${message}`, meta);
};

// Función para logs de seguridad
logger.security = (message, meta = {}) => {
    logger.warn(`[SECURITY] ${message}`, meta);
};

module.exports = logger;