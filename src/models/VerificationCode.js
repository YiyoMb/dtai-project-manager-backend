const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const VerificationCode = sequelize.define('VerificationCode', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
            isEmail: true,
            notEmpty: true,
        },
    },
    code: {
        type: DataTypes.STRING(6),
        allowNull: false,
        validate: {
            len: [6, 6],
            isNumeric: true,
        },
    },
    type: {
        type: DataTypes.ENUM('email_verification', 'password_reset'),
        allowNull: false,
        defaultValue: 'email_verification',
    },
    expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
        validate: {
            isDate: true,
            isAfter: new Date().toISOString(),
        },
    },
    used: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
    },
    attempts: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
        validate: {
            min: 0,
            max: 10,
        },
    },
}, {
    tableName: 'verification_codes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            fields: ['email', 'type'],
            name: 'idx_verification_codes_email_type',
        },
        {
            fields: ['expires_at'],
            name: 'idx_verification_codes_expires',
        },
        {
            fields: ['used'],
            name: 'idx_verification_codes_used',
        },
        {
            fields: ['created_at'],
            name: 'idx_verification_codes_created',
        },
    ],
    hooks: {
        beforeCreate: (verificationCode) => {
            // Asegurar que el código tenga exactamente 6 dígitos
            if (verificationCode.code.length !== 6) {
                throw new Error('El código debe tener exactamente 6 dígitos');
            }
        },
        beforeUpdate: (verificationCode) => {
            // Prevenir modificación del código una vez creado
            if (verificationCode.changed('code')) {
                throw new Error('El código no puede ser modificado');
            }
        },
    },
});

// Método estático para limpiar códigos expirados
VerificationCode.cleanupExpired = async function() {
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
        console.error('Error cleaning up expired verification codes:', error);
        return 0;
    }
};

// Método estático para obtener códigos activos de un usuario
VerificationCode.getActiveCodesForUser = async function(email, type = 'email_verification') {
    return await this.findAll({
        where: {
            email,
            type,
            used: false,
            expires_at: {
                [sequelize.Sequelize.Op.gt]: new Date(),
            },
        },
        order: [['created_at', 'DESC']],
    });
};

// Método de instancia para verificar si está expirado
VerificationCode.prototype.isExpired = function() {
    return new Date() > this.expires_at;
};

// Método de instancia para verificar si puede intentar más veces
VerificationCode.prototype.canAttempt = function() {
    return this.attempts < 5 && !this.used && !this.isExpired();
};

module.exports = VerificationCode;