const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

// Configuración de la base de datos
const sequelize = new Sequelize({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    database: process.env.DB_NAME || 'GDP',
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'diego1234',
    dialect: process.env.DB_DIALECT || 'mysql',
    logging: process.env.NODE_ENV === 'development' ? (msg) => logger.info(msg) : false,
    pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000,
    },
    timezone: '-06:00',
    define: {
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    },
});

// Función para probar la conexión
async function testConnection() {
    try {
        await sequelize.authenticate();
        logger.info('✅ Conexión a la base de datos establecida correctamente');
        return true;
    } catch (error) {
        logger.error('❌ Error al conectar con la base de datos:', error);
        return false;
    }
}

// Función para sincronizar modelos
async function syncModels(options = {}) {
    try {
        await sequelize.sync(options);
        logger.info('✅ Modelos sincronizados correctamente');
    } catch (error) {
        logger.error('❌ Error al sincronizar modelos:', error);
        throw error;
    }
}

module.exports = {
    sequelize,
    testConnection,
    syncModels,
};