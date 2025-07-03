const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Role = sequelize.define('Role', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        validate: {
            notEmpty: true,
            len: [2, 50],
        },
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
}, {
    tableName: 'roles',
    timestamps: false,
    indexes: [
        {
            unique: true,
            fields: ['name'],
        },
    ],
});

// Método para obtener roles activos
Role.getActiveRoles = async function() {
    return await this.findAll({
        where: {
            name: {
                [sequelize.Sequelize.Op.in]: ['superadministrador', 'administrador', 'colaborador', 'cliente']
            }
        },
        order: [['name', 'ASC']],
    });
};

// Método para verificar si un rol existe
Role.roleExists = async function(roleName) {
    const role = await this.findOne({
        where: { name: roleName }
    });
    return !!role;
};

// Método para obtener permisos por rol
Role.getPermissions = function(roleName) {
    const permissions = {
        superadministrador: {
            users: ['create', 'read', 'update', 'delete'],
            roles: ['create', 'read', 'update', 'delete'],
            portfolios: ['create', 'read', 'update', 'delete'],
            programs: ['create', 'read', 'update', 'delete'],
            projects: ['create', 'read', 'update', 'delete'],
            documents: ['create', 'read', 'update', 'delete', 'approve', 'sign'],
            tasks: ['create', 'read', 'update', 'delete', 'assign'],
            meetings: ['create', 'read', 'update', 'delete'],
            notifications: ['create', 'read', 'update', 'delete'],
            dashboard: ['read'],
            system: ['configure'],
        },
        administrador: {
            users: ['read', 'update'],
            portfolios: ['create', 'read', 'update', 'delete'],
            programs: ['create', 'read', 'update', 'delete'],
            projects: ['create', 'read', 'update', 'delete'],
            documents: ['create', 'read', 'update', 'approve', 'sign'],
            tasks: ['create', 'read', 'update', 'delete', 'assign'],
            meetings: ['create', 'read', 'update', 'delete'],
            notifications: ['read', 'update'],
            dashboard: ['read'],
        },
        colaborador: {
            portfolios: ['read'],
            programs: ['read'],
            projects: ['read'],
            documents: ['create', 'read', 'update'],
            tasks: ['create', 'read', 'update'],
            meetings: ['read', 'update'],
            notifications: ['read', 'update'],
            dashboard: ['read'],
        },
        cliente: {
            projects: ['read'],
            documents: ['read', 'approve', 'sign'],
            tasks: ['read'],
            meetings: ['read'],
            notifications: ['read'],
            dashboard: ['read'],
        },
    };

    return permissions[roleName] || {};
};

// Método para verificar permisos
Role.hasPermission = function(roleName, resource, action) {
    const permissions = this.getPermissions(roleName);
    return permissions[resource] && permissions[resource].includes(action);
};

module.exports = Role;