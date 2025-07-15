const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Portfolio = sequelize.define('Portfolio', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
            notEmpty: {
                msg: 'El nombre del portafolio es obligatorio'
            },
            len: {
                args: [2, 100],
                msg: 'El nombre debe tener entre 2 y 100 caracteres'
            }
        }
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        validate: {
            len: {
                args: [0, 1000],
                msg: 'La descripción no puede exceder 1000 caracteres'
            }
        }
    },
    created_by: {
        type: DataTypes.BIGINT,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        },
        validate: {
            isInt: {
                msg: 'El ID del creador debe ser un número entero'
            }
        }
    }
}, {
    tableName: 'portfolios',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false, // Solo usamos created_at según tu esquema

    // Índices para optimización
    indexes: [
        {
            name: 'idx_portfolios_name',
            fields: ['name']
        },
        {
            name: 'idx_portfolios_created_by',
            fields: ['created_by']
        },
        {
            name: 'idx_portfolios_created_at',
            fields: ['created_at']
        }
    ],

    // Validaciones a nivel de modelo
    validate: {
        // Validación personalizada si necesitamos lógica más compleja
        async validateCreator() {
            if (this.created_by) {
                const User = require('./User');
                const creator = await User.findByPk(this.created_by);
                if (!creator) {
                    throw new Error('El usuario creador no existe');
                }
                if (!creator.is_active) {
                    throw new Error('El usuario creador no está activo');
                }
            }
        }
    },

    // Hooks para lógica adicional
    hooks: {
        beforeCreate: async (portfolio, options) => {
            // Log de auditoría
            console.log(`Creando nuevo portafolio: ${portfolio.name}`);
        },

        afterCreate: async (portfolio, options) => {
            // Aquí podríamos disparar notificaciones, logs, etc.
            const ActivityLog = require('./ActivityLog');
            if (portfolio.created_by) {
                await ActivityLog.create({
                    user_id: portfolio.created_by,
                    action: `Creó el portafolio: ${portfolio.name}`
                });
            }
        }
    }
});

// Métodos de instancia útiles
Portfolio.prototype.toJSON = function() {
    const values = { ...this.get() };

    // No exponer información sensible si es necesario
    // En este caso, Portfolio no tiene datos sensibles

    return values;
};

// Métodos estáticos para consultas comunes
Portfolio.findWithPrograms = async function(portfolioId) {
    return await this.findByPk(portfolioId, {
        include: [
            {
                association: 'programs',
                include: ['projects'] // Si queremos incluir proyectos también
            },
            {
                association: 'creator',
                attributes: ['id', 'name', 'email'] // Solo campos necesarios del usuario
            }
        ]
    });
};

Portfolio.findByCreator = async function(userId, options = {}) {
    return await this.findAll({
        where: {
            created_by: userId
        },
        include: options.include || [],
        order: [['created_at', 'DESC']],
        ...options
    });
};

module.exports = Portfolio;