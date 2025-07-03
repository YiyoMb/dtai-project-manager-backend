const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Role = require('../models/Role');
const tokenService = require('./tokenService');
const emailService = require('./emailService');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

class AuthService {
    /**
     * Registra un nuevo usuario
     * @param {Object} userData - Datos del usuario
     * @returns {Object} Usuario creado y tokens
     */
    async register(userData) {
        try {
            const { name, email, password, role_id } = userData;

            // Verificar si el email ya existe
            const existingUser = await User.findByEmail(email);
            if (existingUser) {
                throw new Error('El email ya está registrado');
            }

            // Verificar si el rol existe
            const role = await Role.findByPk(role_id);
            if (!role) {
                throw new Error('El rol especificado no existe');
            }

            // Crear el usuario
            const user = await User.create({
                name: name.trim(),
                email: email.toLowerCase().trim(),
                password,
                role_id,
                email_verified: false,
                verification_token: tokenService.generateVerificationToken(),
            });

            // Obtener el usuario completo con el rol
            const userWithRole = await User.findByPk(user.id, {
                include: [{
                    model: Role,
                    as: 'role',
                    attributes: ['id', 'name', 'description'],
                }],
            });

            // Generar tokens
            const tokens = tokenService.generateTokenPair(userWithRole);

            // Enviar email de verificación
            //await this.sendVerificationEmail(userWithRole);

            // Registrar actividad
            await this.logActivity(userWithRole.id, 'Usuario registrado');

            return {
                user: userWithRole.getPublicData(),
                tokens,
                message: 'Usuario registrado exitosamente. Revisa tu email para verificar tu cuenta.',
            };
        } catch (error) {
            logger.error('Error in register:', error);
            throw error;
        }
    }

    /**
     * Autentica un usuario
     * @param {string} email - Email del usuario
     * @param {string} password - Contraseña
     * @param {string} ipAddress - IP del cliente
     * @param {string} userAgent - User agent del cliente
     * @returns {Object} Usuario autenticado y tokens
     */
    async login(email, password, ipAddress = null, userAgent = null) {
        try {
            // Buscar usuario por email
            const user = await User.findByEmail(email);
            if (!user) {
                throw new Error('Credenciales inválidas');
            }

            // Verificar si el usuario está activo
            if (!user.is_active) {
                throw new Error('Usuario inactivo. Contacta al administrador.');
            }

            // Verificar si el usuario está bloqueado
            if (user.isLocked()) {
                const lockTime = Math.ceil((user.locked_until - Date.now()) / 1000 / 60);
                throw new Error(`Cuenta bloqueada. Intenta de nuevo en ${lockTime} minutos.`);
            }

            // Verificar contraseña
            const isPasswordValid = await user.validatePassword(password);
            if (!isPasswordValid) {
                await user.incrementFailedAttempts();
                throw new Error('Credenciales inválidas');
            }

            // Resetear intentos fallidos y actualizar último login
            await user.resetFailedAttempts();
            await user.updateLastLogin();

            // Generar tokens
            const tokens = tokenService.generateTokenPair(user);

            // Registrar actividad
            await this.logActivity(user.id, 'Inicio de sesión exitoso', { ipAddress, userAgent });

            return {
                user: user.getPublicData(),
                tokens,
                message: 'Inicio de sesión exitoso',
            };
        } catch (error) {
            logger.error('Error in login:', error);
            throw error;
        }
    }

    /**
     * Renueva el token de acceso usando el refresh token
     * @param {string} refreshToken - Token de refresco
     * @returns {Object} Nuevos tokens
     */
    async refreshToken(refreshToken) {
        try {
            // Verificar el refresh token
            const decoded = tokenService.verifyRefreshToken(refreshToken);

            // Buscar el usuario
            const user = await User.findByPk(decoded.userId, {
                include: [{
                    model: Role,
                    as: 'role',
                    attributes: ['id', 'name', 'description'],
                }],
            });

            if (!user || !user.is_active) {
                throw new Error('Usuario no encontrado o inactivo');
            }

            // Generar nuevos tokens
            const tokens = tokenService.generateTokenPair(user);

            // Registrar actividad
            await this.logActivity(user.id, 'Token renovado');

            return {
                tokens,
                message: 'Token renovado exitosamente',
            };
        } catch (error) {
            logger.error('Error in refreshToken:', error);
            throw error;
        }
    }

    /**
     * Cierra la sesión del usuario
     * @param {number} userId - ID del usuario
     * @returns {Object} Mensaje de confirmación
     */
    async logout(userId) {
        try {
            // Registrar actividad
            await this.logActivity(userId, 'Cierre de sesión');

            return {
                message: 'Sesión cerrada exitosamente',
            };
        } catch (error) {
            logger.error('Error in logout:', error);
            throw error;
        }
    }

    /**
     * Solicita el reset de contraseña
     * @param {string} email - Email del usuario
     * @returns {Object} Mensaje de confirmación
     */
    async requestPasswordReset(email) {
        try {
            const user = await User.findByEmail(email);
            if (!user) {
                // Por seguridad, no revelamos si el email existe
                return {
                    message: 'Si el email existe, recibirás un enlace para restablecer tu contraseña',
                };
            }

            // Generar token de reset
            const resetToken = tokenService.generateResetToken();
            const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

            // Guardar token en la base de datos
            await user.update({
                reset_password_token: resetToken,
                reset_password_expires: resetExpires,
            });

            // Enviar email
            //await emailService.sendPasswordResetEmail(user.email, resetToken);

            // Registrar actividad
            await this.logActivity(user.id, 'Solicitud de reset de contraseña');

            return {
                message: 'Si el email existe, recibirás un enlace para restablecer tu contraseña',
            };
        } catch (error) {
            logger.error('Error in requestPasswordReset:', error);
            throw error;
        }
    }

    /**
     * Restablece la contraseña del usuario
     * @param {string} token - Token de reset
     * @param {string} newPassword - Nueva contraseña
     * @returns {Object} Mensaje de confirmación
     */
    async resetPassword(token, newPassword) {
        try {
            // Buscar usuario por token
            const user = await User.findOne({
                where: {
                    reset_password_token: token,
                    reset_password_expires: {
                        [Op.gt]: new Date(),
                    },
                },
            });

            if (!user) {
                throw new Error('Token inválido o expirado');
            }

            // Actualizar contraseña
            await user.update({
                password: newPassword,
                reset_password_token: null,
                reset_password_expires: null,
                failed_login_attempts: 0,
                locked_until: null,
            });

            // Registrar actividad
            await this.logActivity(user.id, 'Contraseña restablecida');

            return {
                message: 'Contraseña restablecida exitosamente',
            };
        } catch (error) {
            logger.error('Error in resetPassword:', error);
            throw error;
        }
    }

    /**
     * Cambia la contraseña del usuario autenticado
     * @param {number} userId - ID del usuario
     * @param {string} currentPassword - Contraseña actual
     * @param {string} newPassword - Nueva contraseña
     * @returns {Object} Mensaje de confirmación
     */
    async changePassword(userId, currentPassword, newPassword) {
        try {
            const user = await User.findByPk(userId);
            if (!user) {
                throw new Error('Usuario no encontrado');
            }

            // Verificar contraseña actual
            const isCurrentPasswordValid = await user.validatePassword(currentPassword);
            if (!isCurrentPasswordValid) {
                throw new Error('Contraseña actual incorrecta');
            }

            // Actualizar contraseña
            await user.update({ password: newPassword });

            // Registrar actividad
            await this.logActivity(userId, 'Contraseña cambiada');

            return {
                message: 'Contraseña cambiada exitosamente',
            };
        } catch (error) {
            logger.error('Error in changePassword:', error);
            throw error;
        }
    }

    /**
     * Verifica el email del usuario
     * @param {string} token - Token de verificación
     * @returns {Object} Mensaje de confirmación
     */
    async verifyEmail(token) {
        try {
            const user = await User.findOne({
                where: { verification_token: token },
            });

            if (!user) {
                throw new Error('Token de verificación inválido');
            }

            // Actualizar usuario como verificado
            await user.update({
                email_verified: true,
                verification_token: null,
            });

            // Registrar actividad
            await this.logActivity(user.id, 'Email verificado');

            return {
                message: 'Email verificado exitosamente',
            };
        } catch (error) {
            logger.error('Error in verifyEmail:', error);
            throw error;
        }
    }

    /**
     * Obtiene el perfil del usuario
     * @param {number} userId - ID del usuario
     * @returns {Object} Datos del usuario
     */
    async getProfile(userId) {
        try {
            const user = await User.findByPk(userId, {
                include: [{
                    model: Role,
                    as: 'role',
                    attributes: ['id', 'name', 'description'],
                }],
            });

            if (!user) {
                throw new Error('Usuario no encontrado');
            }

            return {
                user: user.getPublicData(),
            };
        } catch (error) {
            logger.error('Error in getProfile:', error);
            throw error;
        }
    }

    /**
     * Actualiza el perfil del usuario
     * @param {number} userId - ID del usuario
     * @param {Object} updateData - Datos a actualizar
     * @returns {Object} Usuario actualizado
     */
    async updateProfile(userId, updateData) {
        try {
            const user = await User.findByPk(userId);
            if (!user) {
                throw new Error('Usuario no encontrado');
            }

            // Campos permitidos para actualizar
            const allowedFields = ['name'];
            const filteredData = {};

            for (const field of allowedFields) {
                if (updateData[field] !== undefined) {
                    filteredData[field] = updateData[field];
                }
            }

            // Actualizar usuario
            await user.update(filteredData);

            // Obtener usuario actualizado con rol
            const updatedUser = await User.findByPk(userId, {
                include: [{
                    model: Role,
                    as: 'role',
                    attributes: ['id', 'name', 'description'],
                }],
            });

            // Registrar actividad
            await this.logActivity(userId, 'Perfil actualizado');

            return {
                user: updatedUser.getPublicData(),
                message: 'Perfil actualizado exitosamente',
            };
        } catch (error) {
            logger.error('Error in updateProfile:', error);
            throw error;
        }
    }

    /**
     * Envía email de verificación
     * @param {Object} user - Usuario
     */
    async sendVerificationEmail(user) {
        try {
            if (user.verification_token) {
                await emailService.sendVerificationEmail(user.email, user.verification_token);
            }
        } catch (error) {
            logger.error('Error sending verification email:', error);
            // No lanzamos error para no interrumpir el flujo principal
        }
    }

    /**
     * Registra actividad del usuario
     * @param {number} userId - ID del usuario
     * @param {string} action - Acción realizada
     * @param {Object} metadata - Datos adicionales
     */
    async logActivity(userId, action, metadata = {}) {
        try {
            const ActivityLog = require('../models/ActivityLog');
            await ActivityLog.create({
                user_id: userId,
                action,
                metadata: JSON.stringify(metadata),
            });
        } catch (error) {
            logger.error('Error logging activity:', error);
            // No lanzamos error para no interrumpir el flujo principal
        }
    }
}

module.exports = new AuthService();