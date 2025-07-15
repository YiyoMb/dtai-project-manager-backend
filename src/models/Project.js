const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Project = sequelize.define('Project', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    program_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'programs',
            key: 'id'
        },
        validate: {
            isInt: {
                msg: 'El ID del programa debe ser un número entero'
            }
        }
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
            notEmpty: {
                msg: 'El nombre del proyecto es obligatorio'
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
                args: [0, 2000],
                msg: 'La descripción no puede exceder 2000 caracteres'
            }
        }
    },
    status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'pendiente',
        validate: {
            isIn: {
                args: [['pendiente', 'en_proceso', 'completado', 'cancelado']],
                msg: 'El estado debe ser: pendiente, en_proceso, completado o cancelado'
            }
        }
    },
    risk_level: {
        type: DataTypes.STRING(50),
        allowNull: true,
        validate: {
            isIn: {
                args: [['bajo', 'medio', 'alto', 'critico']],
                msg: 'El nivel de riesgo debe ser: bajo, medio, alto o critico'
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
    tableName: 'projects',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false, // Solo usamos created_at según tu esquema

    // Índices para optimización
    indexes: [
        {
            name: 'idx_projects_program_id',
            fields: ['program_id']
        },
        {
            name: 'idx_projects_name',
            fields: ['name']
        },
        {
            name: 'idx_projects_status',
            fields: ['status']
        },
        {
            name: 'idx_projects_risk_level',
            fields: ['risk_level']
        },
        {
            name: 'idx_projects_created_by',
            fields: ['created_by']
        },
        {
            name: 'idx_projects_created_at',
            fields: ['created_at']
        },
        {
            // Índice compuesto para búsquedas frecuentes
            name: 'idx_projects_program_status',
            fields: ['program_id', 'status']
        },
        {
            // Índice para proyectos de alto riesgo
            name: 'idx_projects_risk_status',
            fields: ['risk_level', 'status']
        }
    ],

    // Validaciones a nivel de modelo
    validate: {
        // Validación personalizada para verificar que el programa existe
        async validateProgram() {
            if (this.program_id) {
                const Program = require('./Program');
                const program = await Program.findByPk(this.program_id);
                if (!program) {
                    throw new Error('El programa especificado no existe');
                }
                if (program.status === 'cancelado') {
                    throw new Error('No se pueden crear proyectos en un programa cancelado');
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
        },

        // Validación de coherencia entre riesgo y estado
        validateRiskStatus() {
            if (this.status === 'completado' && this.risk_level === 'critico') {
                // Permitir, pero podríamos agregar lógica específica
            }
        }
    },

    // Hooks para lógica adicional
    hooks: {
        beforeCreate: async (project, options) => {
            // Log de auditoría
            console.log(`Creando nuevo proyecto: ${project.name} en programa ${project.program_id}`);

            // Si no se especifica nivel de riesgo, establecer por defecto
            if (!project.risk_level) {
                project.risk_level = 'bajo';
            }
        },

        afterCreate: async (project, options) => {
            // Disparar notificaciones, logs, etc.
            const ActivityLog = require('./ActivityLog');
            if (project.created_by) {
                await ActivityLog.create({
                    user_id: project.created_by,
                    action: `Creó el proyecto: ${project.name}`
                });
            }
        },

        beforeUpdate: async (project, options) => {
            // Log de cambios importantes
            if (project.changed('status')) {
                console.log(`Proyecto ${project.name} cambió estado a: ${project.status}`);
            }
            if (project.changed('risk_level')) {
                console.log(`Proyecto ${project.name} cambió nivel de riesgo a: ${project.risk_level}`);
            }
        },

        afterUpdate: async (project, options) => {
            // Log de actividad para cambios importantes
            if ((project.changed('status') || project.changed('risk_level')) && project.created_by) {
                const ActivityLog = require('./ActivityLog');
                let action = '';

                if (project.changed('status')) {
                    action += `Cambió estado del proyecto ${project.name} a: ${project.status}`;
                }
                if (project.changed('risk_level')) {
                    if (action) action += ' y ';
                    action += `cambió nivel de riesgo a: ${project.risk_level}`;
                }

                if (action) {
                    await ActivityLog.create({
                        user_id: project.created_by,
                        action: action
                    });
                }
            }
        }
    }
});

// Métodos de instancia útiles
Project.prototype.toJSON = function() {
    const values = { ...this.get() };

    // Agregar campos calculados útiles
    values.isPending = this.status === 'pendiente';
    values.isInProgress = this.status === 'en_proceso';
    values.isCompleted = this.status === 'completado';
    values.isCanceled = this.status === 'cancelado';
    values.isHighRisk = ['alto', 'critico'].includes(this.risk_level);
    values.isCritical = this.risk_level === 'critico';

    return values;
};

// Métodos estáticos para consultas comunes
Project.findByProgram = async function(programId, options = {}) {
    const { status, risk_level, includeDetails = false } = options;

    const whereClause = { program_id: programId };
    if (status) {
        whereClause.status = status;
    }
    if (risk_level) {
        whereClause.risk_level = risk_level;
    }

    const includeOptions = [
        {
            association: 'creator',
            attributes: ['id', 'name', 'email']
        }
    ];

    if (includeDetails) {
        includeOptions.push(
            {
                association: 'program',
                attributes: ['id', 'name', 'status'],
                include: [
                    {
                        association: 'portfolio',
                        attributes: ['id', 'name']
                    }
                ]
            }
        );
    }

    return await this.findAll({
        where: whereClause,
        include: includeOptions,
        order: [['created_at', 'DESC']],
        ...options
    });
};

Project.findHighRiskProjects = async function(programId = null) {
    const whereClause = {
        risk_level: ['alto', 'critico'],
        status: ['pendiente', 'en_proceso'] // Solo proyectos activos
    };

    if (programId) {
        whereClause.program_id = programId;
    }

    return await this.findAll({
        where: whereClause,
        include: [
            {
                association: 'creator',
                attributes: ['id', 'name', 'email']
            },
            {
                association: 'program',
                attributes: ['id', 'name'],
                include: [
                    {
                        association: 'portfolio',
                        attributes: ['id', 'name']
                    }
                ]
            }
        ],
        order: [
            ['risk_level', 'DESC'], // Crítico primero
            ['created_at', 'ASC']    // Más antiguos primero
        ]
    });
};

Project.findWithFullDetails = async function(projectId) {
    return await this.findByPk(projectId, {
        include: [
            {
                association: 'program',
                attributes: ['id', 'name', 'status'],
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
                    }
                ]
            },
            {
                association: 'creator',
                attributes: ['id', 'name', 'email']
            }
        ]
    });
};

Project.countByProgram = async function(programId) {
    const counts = await this.findAll({
        where: { program_id: programId },
        attributes: [
            'status',
            'risk_level',
            [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['status', 'risk_level'],
        raw: true
    });

    // Procesar resultados en formato útil
    const result = {
        total: 0,
        by_status: {
            pendiente: 0,
            en_proceso: 0,
            completado: 0,
            cancelado: 0
        },
        by_risk: {
            bajo: 0,
            medio: 0,
            alto: 0,
            critico: 0
        }
    };

    counts.forEach(count => {
        const total = parseInt(count.count);
        result.total += total;

        if (count.status) {
            result.by_status[count.status] += total;
        }
        if (count.risk_level) {
            result.by_risk[count.risk_level] += total;
        }
    });

    return result;
};

Project.getProjectsByRiskLevel = async function(riskLevel, limit = 10) {
    return await this.findAll({
        where: {
            risk_level: riskLevel,
            status: ['pendiente', 'en_proceso']
        },
        include: [
            {
                association: 'program',
                attributes: ['id', 'name']
            },
            {
                association: 'creator',
                attributes: ['id', 'name']
            }
        ],
        order: [['created_at', 'DESC']],
        limit: limit
    });
};

module.exports = Project;