const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ActivityLog = sequelize.define('ActivityLog', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    user_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
    },
    action: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    metadata: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
            const value = this.getDataValue('metadata');
            return value ? JSON.parse(value) : null;
        },
        set(value) {
            this.setDataValue('metadata', JSON.stringify(value));
        },
    },
}, {
    tableName: 'activity_logs',
    timestamps: true,
    updatedAt: false,
    indexes: [
        {
            fields: ['user_id'],
        },
        {
            fields: ['created_at'],
        },
    ],
});

// Método estático para crear log de actividad
ActivityLog.logActivity = async function(userId, action, metadata = {}) {
    try {
        return await this.create({
            user_id: userId,
            action,
            metadata,
        });
    } catch (error) {
        console.error('Error logging activity:', error);
        // No lanzar error para no interrumpir el flujo principal
    }
};

// Método estático para obtener actividades de un usuario
ActivityLog.getUserActivities = async function(userId, options = {}) {
    const { limit = 50, offset = 0 } = options;

    return await this.findAll({
        where: { user_id: userId },
        include: [{
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'name', 'email'],
        }],
        limit,
        offset,
        order: [['created_at', 'DESC']],
    });
};

// Método estático para obtener actividades recientes
ActivityLog.getRecentActivities = async function(options = {}) {
    const { limit = 100, offset = 0 } = options;

    return await this.findAll({
        include: [{
            model: sequelize.models.User,
            as: 'user',
            attributes: ['id', 'name', 'email'],
        }],
        limit,
        offset,
        order: [['created_at', 'DESC']],
    });
};

module.exports = ActivityLog;