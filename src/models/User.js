const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [2, 100],
        },
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
    password: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [6, 255],
        },
    },
    role_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'roles',
            key: 'id',
        },
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    last_login: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    email_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    verification_token: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    reset_password_token: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    reset_password_expires: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    failed_login_attempts: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
    locked_until: {
        type: DataTypes.DATE,
        allowNull: true,
    },
}, {
    tableName: 'users',
    timestamps: true,
    indexes: [
        {
            unique: true,
            fields: ['email'],
        },
        {
            fields: ['role_id'],
        },
        {
            fields: ['is_active'],
        },
    ],
    hooks: {
        beforeCreate: async (user) => {
            if (user.password) {
                user.password = await bcrypt.hash(user.password, 12);
            }
        },
        beforeUpdate: async (user) => {
            if (user.changed('password')) {
                user.password = await bcrypt.hash(user.password, 12);
            }
        },
    },
});

// Método de instancia para verificar contraseña
User.prototype.validatePassword = async function(password) {
    return await bcrypt.compare(password, this.password);
};

// Método para obtener datos públicos del usuario
User.prototype.getPublicData = function() {
    const userData = this.toJSON();
    delete userData.password;
    delete userData.reset_password_token;
    delete userData.reset_password_expires;
    delete userData.verification_token;
    delete userData.failed_login_attempts;
    delete userData.locked_until;
    return userData;
};

// Método para verificar si el usuario está bloqueado
User.prototype.isLocked = function() {
    return this.locked_until && this.locked_until > Date.now();
};

// Método para incrementar intentos fallidos
User.prototype.incrementFailedAttempts = async function() {
    // Si ya estaba bloqueado y el tiempo expiró, reiniciar contador
    if (this.locked_until && this.locked_until <= Date.now()) {
        return await this.update({
            failed_login_attempts: 1,
            locked_until: null,
        });
    }

    const updates = { failed_login_attempts: this.failed_login_attempts + 1 };

    // Bloquear después de 5 intentos fallidos por 30 minutos
    if (updates.failed_login_attempts >= 5) {
        updates.locked_until = Date.now() + 30 * 60 * 1000; // 30 minutos
    }

    return await this.update(updates);
};

// Método para reiniciar intentos fallidos
User.prototype.resetFailedAttempts = async function() {
    return await this.update({
        failed_login_attempts: 0,
        locked_until: null,
    });
};

// Método para actualizar último login
User.prototype.updateLastLogin = async function() {
    return await this.update({
        last_login: new Date(),
    });
};

// Método estático para encontrar usuario por email
User.findByEmail = async function(email) {
    return await this.findOne({
        where: { email: email.toLowerCase() },
        include: [{
            model: sequelize.models.Role,
            as: 'role',
            attributes: ['id', 'name', 'description'],
        }],
    });
};

// Método estático para encontrar usuarios activos
User.findActiveUsers = async function(options = {}) {
    return await this.findAll({
        where: { is_active: true },
        include: [{
            model: sequelize.models.Role,
            as: 'role',
            attributes: ['id', 'name', 'description'],
        }],
        attributes: { exclude: ['password', 'reset_password_token', 'verification_token'] },
        ...options,
    });
};

// Método estático para crear usuario con validaciones
User.createUser = async function(userData) {
    const { name, email, password, role_id } = userData;

    // Verificar si el email ya existe
    const existingUser = await this.findByEmail(email);
    if (existingUser) {
        throw new Error('El email ya está registrado');
    }

    // Verificar si el rol existe
    const role = await sequelize.models.Role.findByPk(role_id);
    if (!role) {
        throw new Error('El rol especificado no existe');
    }

    // Crear el usuario
    const user = await this.create({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password,
        role_id,
    });

    return user;
};

// Método estático para búsqueda con filtros
User.searchUsers = async function(filters = {}) {
    const where = {};

    if (filters.name) {
        where.name = { [sequelize.Sequelize.Op.like]: `%${filters.name}%` };
    }

    if (filters.email) {
        where.email = { [sequelize.Sequelize.Op.like]: `%${filters.email}%` };
    }

    if (filters.role_id) {
        where.role_id = filters.role_id;
    }

    if (filters.is_active !== undefined) {
        where.is_active = filters.is_active;
    }

    return await this.findAll({
        where,
        include: [{
            model: sequelize.models.Role,
            as: 'role',
            attributes: ['id', 'name', 'description'],
        }],
        attributes: { exclude: ['password', 'reset_password_token', 'verification_token'] },
        order: [['created_at', 'DESC']],
    });
};

module.exports = User;