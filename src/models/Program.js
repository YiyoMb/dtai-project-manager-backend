const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Program = sequelize.define('Program', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    portfolio_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'portfolios',
            key: 'id'
        },
        validate: {
            isInt: {
                msg: 'El ID del portfolio debe ser un número entero'
            }
        }
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
            notEmpty: {
                msg: 'El nombre del programa es obligatorio'
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
    status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'activo',
        validate: {
            isIn: {
                args: [['activo', 'pausado', 'completado', 'cancelado']],
                msg: 'El estado debe ser: activo, pausado, completado o cancelado'
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
    tableName: 'programs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false, // Solo usamos created_at según tu esquema

    // Índices para optimización
    indexes: [
        {
            name: 'idx_programs_portfolio_id',
            fields: ['portfolio_id']
        },
        {
            name: 'idx_programs_name',
            fields: ['name']
        },
        {
            name: 'idx_programs_status',
            fields: ['status']
        },
        {
            name: 'idx_programs_created_by',
            fields: ['created_by']
        },
        {
            name: 'idx_programs_created_at',
            fields: ['created_at']
        },
        {
            // Índice compuesto para búsquedas frecuentes
            name: 'idx_programs_portfolio_status',
            fields: ['portfolio_id', 'status']
        }
    ],

    // Validaciones a nivel de modelo
    validate: {
        // Validación personalizada para verificar que el portfolio existe
        async validatePortfolio() {
            if (this.portfolio_id) {
                const Portfolio = require('./Portfolio');
                const portfolio = await Portfolio.findByPk(this.portfolio_id);
                if (!portfolio) {
                    throw new Error('El portfolio especificado no existe');
                }
            }
        },

        // Validación personalizada para verificar el creador
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
        beforeCreate: async (program, options) => {
            // Log de auditoría
            console.log(`Creando nuevo programa: ${program.name} en portfolio ${program.portfolio_id}`);
        },

        afterCreate: async (program, options) => {
            // Disparar notificaciones, logs, etc.
            const ActivityLog = require('./ActivityLog');
            if (program.created_by) {
                await ActivityLog.create({
                    user_id: program.created_by,
                    action: `Creó el programa: ${program.name}`
                });
            }
        },

        beforeUpdate: async (program, options) => {
            // Log de cambios de estado
            if (program.changed('status')) {
                console.log(`Programa ${program.name} cambió estado a: ${program.status}`);
            }
        },

        afterUpdate: async (program, options) => {
            // Log de actividad para cambios importantes
            if (program.changed('status') && program.created_by) {
                const ActivityLog = require('./ActivityLog');
                await ActivityLog.create({
                    user_id: program.created_by,
                    action: `Cambió estado del programa ${program.name} a: ${program.status}`
                });
            }
        }
    }
});

// Métodos de instancia útiles
Program.prototype.toJSON = function() {
    const values = { ...this.get() };

    // Agregar campos calculados útiles
    values.isActive = this.status === 'activo';
    values.isCompleted = this.status === 'completado';

    return values;
};

// Métodos estáticos para consultas comunes
Program.findByPortfolio = async function(portfolioId, options = {}) {
    const { status, includeProjects = false } = options;

    const whereClause = { portfolio_id: portfolioId };
    if (status) {
        whereClause.status = status;
    }

    const includeOptions = [
        {
            association: 'creator',
            attributes: ['id', 'name', 'email']
        },
        {
            association: 'portfolio',
            attributes: ['id', 'name']
        }
    ];

    if (includeProjects) {
        includeOptions.push({
            association: 'projects',
            required: false
        });
    }

    return await this.findAll({
        where: whereClause,
        include: includeOptions,
        order: [['created_at', 'DESC']],
        ...options
    });
};

Program.findActiveByPortfolio = async function(portfolioId) {
    return await this.findByPortfolio(portfolioId, { status: 'activo' });
};

Program.findWithProjects = async function(programId) {
    return await this.findByPk(programId, {
        include: [
            {
                association: 'portfolio',
                attributes: ['id', 'name'],
                include: [
                    {
                        association: 'creator',
                        attributes: ['id', 'name', 'email']
                    }
                ]
            },
            {
                association: 'creator',
                attributes: ['id', 'name', 'email']
            },
            {
                association: 'projects',
                required: false,
                include: [
                    {
                        association: 'creator',
                        attributes: ['id', 'name', 'email']
                    }
                ]
            }
        ]
    });
};

Program.countByPortfolio = async function(portfolioId) {
    const counts = await this.findAll({
        where: { portfolio_id: portfolioId },
        attributes: [
            'status',
            [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['status'],
        raw: true
    });

    // Convertir array a objeto para fácil acceso
    const result = {
        total: 0,
        activo: 0,
        pausado: 0,
        completado: 0,
        cancelado: 0
    };

    counts.forEach(count => {
        result[count.status] = parseInt(count.count);
        result.total += parseInt(count.count);
    });

    return result;
};

module.exports = Program;