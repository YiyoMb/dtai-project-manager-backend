require('dotenv').config();
const app = require('./src/app');
const logger = require('./src/utils/logger');
const { connectDatabase } = require('./src/database/connection');

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Función para inicializar el servidor
async function startServer() {
    try {
        logger.info('🚀 Starting DTAI Project Manager Server...');
        logger.info(`📊 Environment: ${NODE_ENV}`);
        logger.info(`🔧 Node.js Version: ${process.version}`);

        // Conectar a la base de datos
        logger.info('🔗 Connecting to database...');
        await connectDatabase();
        logger.info('✅ Database connection established successfully');

        // Iniciar el servidor HTTP
        const server = app.listen(PORT, () => {
            logger.info(`🌐 Server running on port ${PORT}`);
            logger.info(`📡 API Base URL: http://localhost:${PORT}/api`);
            logger.info(`🏥 Health Check: http://localhost:${PORT}/health`);
            logger.info('✅ Server started successfully');

            // Información adicional en desarrollo
            if (NODE_ENV === 'development') {
                logger.info('🔧 Development Mode - Additional Info:');
                logger.info(`   📝 Logs Level: ${process.env.LOG_LEVEL || 'info'}`);
                logger.info(`   🔐 JWT Expires: ${process.env.JWT_EXPIRE || '24h'}`);
                logger.info(`   📧 Email Service: ${process.env.SMTP_HOST || 'Not configured'}`);
                logger.info(`   🗄️  Database: ${process.env.DB_NAME || 'dtai_project_manager'}`);
            }
        });

        // Configurar timeout del servidor
        server.timeout = 30000; // 30 segundos

        // Manejo de cierre graceful
        const gracefulShutdown = (signal) => {
            logger.info(`🛑 Received ${signal} signal, shutting down gracefully...`);

            server.close(async () => {
                logger.info('🔒 HTTP server closed');

                try {
                    // Cerrar conexión a la base de datos
                    const { closeConnection } = require('./src/database/connection');
                    await closeConnection();
                    logger.info('🔒 Database connection closed');

                    logger.info('✅ Graceful shutdown completed');
                    process.exit(0);
                } catch (error) {
                    logger.error('❌ Error during graceful shutdown:', error);
                    process.exit(1);
                }
            });

            // Forzar cierre si no se completa en 10 segundos
            setTimeout(() => {
                logger.error('⏰ Forced shutdown after timeout');
                process.exit(1);
            }, 10000);
        };

        // Escuchar señales de terminación
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

        // Manejo de errores del servidor
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                logger.error(`❌ Port ${PORT} is already in use`);
                process.exit(1);
            } else {
                logger.error('❌ Server error:', error);
                process.exit(1);
            }
        });

        return server;

    } catch (error) {
        logger.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Manejo de errores no capturadas
process.on('unhandledRejection', (reason, promise) => {
    logger.error('❌ Unhandled Promise Rejection:', {
        reason: reason.message || reason,
        stack: reason.stack,
        promise: promise
    });

    // En producción, cerrar el servidor
    if (NODE_ENV === 'production') {
        process.exit(1);
    }
});

process.on('uncaughtException', (error) => {
    logger.error('❌ Uncaught Exception:', {
        message: error.message,
        stack: error.stack
    });

    // Siempre cerrar en excepciones no capturadas
    process.exit(1);
});

// Manejo de advertencias
process.on('warning', (warning) => {
    logger.warn('⚠️  Process Warning:', {
        name: warning.name,
        message: warning.message,
        stack: warning.stack
    });
});

// Información del proceso
logger.info('🔧 Process Information:', {
    pid: process.pid,
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    memoryUsage: process.memoryUsage()
});

// Iniciar el servidor
startServer().catch(error => {
    logger.error('❌ Critical startup error:', error);
    process.exit(1);
});

module.exports = app;