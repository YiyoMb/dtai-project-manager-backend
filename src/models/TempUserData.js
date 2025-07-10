const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TempUserData = sequelize.define('TempUserData', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true,
            notEmpty: true,
        },
    },
    data: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
            notEmpty: true,
        },
        get() {
            const value = this.getDataValue('data');
            try {
                return value ? JSON.parse(value) : null;
            } catch (error) {
                console.error('Error parsing temp user data:', error);
                return null;
            }
        },
        set(value) {
            try {
                this.setDataValue('data', JSON.stringify(value));
            } catch (error) {
                console.error('Error stringifying temp user data:', error);
                throw new Error('Invalid data format for temp user data');
            }
        },
    },
    expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
        validate: {
            isDate: true,
            isAfter: new Date().toISOString(),
        },
    },
}, {
    tableName: 'temp_user_data',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            unique: true,
            fields: ['email'],
            name: 'idx_temp_user_data_email_unique',
        },
        {
            fields: ['expires_at'],
            name: 'idx_temp_user_data_expires',
        },
        {
            fields: ['created_at'],
            name: 'idx_temp_user_data_created',
        },
    ],
    hooks: {
        beforeCreate: (tempUserData) => {
            // Validar que la fecha de expiración sea futura
            if (tempUserData.expires_at <= new Date()) {
                throw new Error('La fecha de expiración debe ser futura');
            }
        },
        beforeUpdate: (tempUserData) => {
            // Prevenir actualización del email una vez creado
            if (tempUserData.changed('email')) {
                throw new Error('El email no puede ser modificado en datos temporales');
            }
        },
    },
});

// Método estático para limpiar datos expirados
TempUserData.cleanupExpired = async function() {
    try {
        const result = await this.destroy({
            where: {
                expires_at: {
                    [sequelize.Sequelize.Op.lt]: new Date(),
                },
            },
        });
        return result;
    } catch (error) {
        console.error('Error cleaning up expired temp user data:', error);
        return 0;
    }
};

// Método estático para obtener datos válidos por email
TempUserData.getValidDataByEmail = async function(email) {
    return await this.findOne({
        where: {
            email,
            expires_at: {
                [sequelize.Sequelize.Op.gt]: new Date(),
            },
        },
    });
};

// Método estático para crear o actualizar datos temporales
TempUserData.createOrUpdate = async function(email, userData, expirationMinutes = 30) {
    try {
        const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);

        // Intentar actualizar si existe
        const [instance, created] = await this.upsert({
            email,
            data: userData,
            expires_at: expiresAt,
        });

        return { instance, created };
    } catch (error) {
        console.error('Error creating or updating temp user data:', error);
        throw error;
    }
};

// Método de instancia para verificar si está expirado
TempUserData.prototype.isExpired = function() {
    return new Date() > this.expires_at;
};

// Método de instancia para obtener datos específicos
TempUserData.prototype.getUserData = function() {
    const data = this.data;
    if (!data) return null;

    return {
        name: data.name,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        role_id: data.role_id,
        role_name: data.role_name,
    };
};

// Método de instancia para extender expiración
TempUserData.prototype.extendExpiration = async function(additionalMinutes = 15) {
    const newExpiresAt = new Date(this.expires_at.getTime() + additionalMinutes * 60 * 1000);
    return await this.update({ expires_at: newExpiresAt });
};

module.exports = TempUserData;