const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Role = require('../models/Role');
const tokenService = require('./tokenService');
const emailService = require('./emailService');
const logger = require('../utils/logger');
const { Op } = require('sequelize');
const ActivityLog = require("../models/ActivityLog");

// Importar modelos de verificación (se crearán si no existen)
let VerificationCode, TempUserData;
try {
    VerificationCode = require('../models/VerificationCode');
    TempUserData = require('../models/TempUserData');
} catch (error) {
    logger.warn('Verification models not found, some features may be disabled');
}

class AuthService {
    // ============================================
    // MÉTODOS DE AUTENTICACIÓN TRADICIONALES
    // ============================================

    /**
     * Registra un nuevo usuario (método tradicional)
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

            // Determinar ruta de redirección según el rol (NUEVA FUNCIONALIDAD)
            const redirectRoutes = {
                'superadministrador': '/dashboard/superadmin',
                'administrador': '/dashboard/admin',
                'colaborador': '/dashboard/colaborador',
                'cliente': '/dashboard/cliente'
            };

            const redirectTo = redirectRoutes[user.role.name] || '/dashboard';

            // Registrar actividad
            await this.logActivity(user.id, 'Inicio de sesión exitoso', { ipAddress, userAgent });

            return {
                user: user.getPublicData(),
                tokens,
                redirectTo, // NUEVA: Redirección automática
                message: 'Inicio de sesión exitoso',
            };
        } catch (error) {
            logger.error('Error in login:', error);
            throw error;
        }
    }

    // ============================================
    // NUEVOS MÉTODOS: REGISTRO CON CÓDIGOS
    // ============================================

    /**
     * Pre-registro: Valida datos y envía código de verificación
     * @param {Object} userData - Datos del usuario
     * @returns {Object} Respuesta del pre-registro
     */
    async preRegister(userData) {
        try {
            if (!VerificationCode || !TempUserData) {
                // Fallback al registro tradicional si no están disponibles los modelos
                logger.warn('Enhanced registration not available, falling back to traditional');
                return await this.register(userData);
            }

            const { firstName, lastName, email, password, role } = userData;

            // Verificar si el email ya existe
            const existingUser = await User.findByEmail(email);
            if (existingUser) {
                throw new Error('Ya existe un usuario con este email');
            }

            // Mapear roles del frontend a la base de datos
            const roleMap = {
                'administrador': 'administrador',
                'colaborador': 'colaborador',
                'cliente': 'cliente'
            };

            const roleName = roleMap[role] || role;
            const roleData = await Role.findOne({ where: { name: roleName } });

            if (!roleData) {
                throw new Error('Rol no válido');
            }

            // Preparar datos temporales
            const fullName = `${firstName} ${lastName}`;
            const tempUserData = {
                name: fullName,
                firstName,
                lastName,
                email: email.toLowerCase().trim(),
                password,
                role_id: roleData.id,
                role_name: roleName,
            };

            // Guardar datos temporales
            await this.saveTempUserData(email, tempUserData, 30);

            // Generar y enviar código de verificación
            const code = await this.generateAndSaveVerificationCode(email, 'email_verification', 15);

            // Enviar email con código
            if (emailService.isServiceAvailable && emailService.isServiceAvailable()) {
                await this.sendVerificationCodeEmail(email, code, fullName);
            } else {
                logger.warn('Email service not available - verification code not sent');
            }

            logger.info(`Pre-registration completed for ${email}`, {
                name: fullName,
                role: roleName,
            });

            return {
                success: true,
                message: 'Código de verificación enviado. Verifica tu correo para completar el registro.',
                data: {
                    email,
                    name: fullName,
                    role: roleName,
                    requiresVerification: true,
                },
            };
        } catch (error) {
            logger.error('Error in preRegister:', error);
            throw error;
        }
    }

    /**
     * Verifica email con código y completa el registro
     * @param {string} email - Email del usuario
     * @param {string} code - Código de verificación
     * @returns {Object} Usuario creado y tokens
     */
    async verifyEmailCode(email, code) {
        try {
            if (!VerificationCode || !TempUserData) {
                throw new Error('Verificación por código no disponible');
            }

            // Verificar código
            const verification = await this.verifyCode(email, code, 'email_verification');

            if (!verification.valid) {
                throw new Error(verification.message);
            }

            // Obtener datos temporales
            const tempUserData = await this.getTempUserData(email);
            if (!tempUserData) {
                throw new Error('Datos de registro no encontrados. Inicia el proceso de registro nuevamente.');
            }

            // Verificar que no existe un usuario con este email
            const existingUser = await User.findByEmail(email);
            if (existingUser) {
                await this.deleteTempUserData(email);
                throw new Error('Ya existe un usuario con este email');
            }

            // Crear usuario verificado
            const user = await User.create({
                name: tempUserData.name,
                email: tempUserData.email,
                password: tempUserData.password,
                role_id: tempUserData.role_id,
                email_verified: true,
                is_active: true,
            });

            // Obtener usuario completo con rol
            const userWithRole = await User.findByPk(user.id, {
                include: [{
                    model: Role,
                    as: 'role',
                    attributes: ['id', 'name', 'description'],
                }],
            });

            // Generar tokens
            const tokens = tokenService.generateTokenPair(userWithRole);

            // Limpiar datos temporales
            await this.deleteTempUserData(email);

            // Registrar actividad
            await this.logActivity(user.id, 'Usuario registrado y verificado');

            return {
                user: userWithRole.getPublicData(),
                tokens,
                message: 'Email verificado y registro completado exitosamente',
            };
        } catch (error) {
            logger.error('Error in verifyEmailCode:', error);
            throw error;
        }
    }

    /**
     * Reenviar código de verificación
     * @param {string} email - Email del usuario
     * @returns {Object} Confirmación
     */
    async resendVerificationCode(email) {
        try {
            if (!TempUserData) {
                throw new Error('Función no disponible');
            }

            // Verificar si existen datos temporales
            const tempUserData = await this.getTempUserData(email);
            if (!tempUserData) {
                throw new Error('No se encontraron datos de registro pendientes para este email');
            }

            // Verificar que no existe usuario ya registrado
            const existingUser = await User.findByEmail(email);
            if (existingUser) {
                await this.deleteTempUserData(email);
                throw new Error('Ya existe un usuario con este email');
            }

            // Generar nuevo código
            const code = await this.generateAndSaveVerificationCode(email, 'email_verification', 15);

            // Enviar email
            if (emailService.isServiceAvailable && emailService.isServiceAvailable()) {
                await this.sendVerificationCodeEmail(email, code, tempUserData.name);
            }

            return {
                message: 'Código de verificación reenviado exitosamente',
            };
        } catch (error) {
            logger.error('Error in resendVerificationCode:', error);
            throw error;
        }
    }

    // ============================================
    // MÉTODOS DE VERIFICACIÓN Y CÓDIGOS
    // ============================================

    /**
     * Genera un código de verificación de 6 dígitos
     * @returns {string} Código de 6 dígitos
     */
    generateVerificationCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    /**
     * Genera y guarda un código de verificación
     * @param {string} email - Email del usuario
     * @param {string} type - Tipo de verificación
     * @param {number} expirationMinutes - Minutos hasta expiración
     * @returns {string} Código generado
     */
    async generateAndSaveVerificationCode(email, type = 'email_verification', expirationMinutes = 15) {
        try {
            if (!VerificationCode) {
                throw new Error('Verification codes not available');
            }

            // Limpiar códigos previos
            await VerificationCode.destroy({
                where: { email, type, used: false },
            });

            // Generar nuevo código
            const code = this.generateVerificationCode();
            const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);

            // Guardar en base de datos
            await VerificationCode.create({
                email,
                code,
                type,
                expires_at: expiresAt,
            });

            return code;
        } catch (error) {
            logger.error('Error generating verification code:', error);
            throw error;
        }
    }

    /**
     * Verifica un código de verificación
     * @param {string} email - Email del usuario
     * @param {string} code - Código a verificar
     * @param {string} type - Tipo de verificación
     * @param {boolean} markAsUsed - Si marcar como usado
     * @returns {Object} Resultado de la verificación
     */
    async verifyCode(email, code, type = 'email_verification', markAsUsed = true) {
        try {
            if (!VerificationCode) {
                throw new Error('Verification codes not available');
            }

            const verification = await VerificationCode.findOne({
                where: { email, type, used: false },
                order: [['created_at', 'DESC']],
            });

            if (!verification) {
                return { valid: false, message: 'Código no encontrado o ya utilizado' };
            }

            if (new Date() > verification.expires_at) {
                return { valid: false, message: 'Código expirado' };
            }

            await verification.increment('attempts');

            if (verification.attempts >= 5) {
                await verification.update({ used: true });
                return { valid: false, message: 'Demasiados intentos. Solicita un nuevo código' };
            }

            if (verification.code !== code) {
                return { valid: false, message: 'Código incorrecto' };
            }

            if (markAsUsed) {
                await verification.update({ used: true });
            }

            return { valid: true, message: 'Código verificado correctamente' };
        } catch (error) {
            logger.error('Error verifying code:', error);
            throw error;
        }
    }

    // ============================================
    // MÉTODOS DE DATOS TEMPORALES
    // ============================================

    /**
     * Guardar datos temporales del usuario
     */
    async saveTempUserData(email, userData, expirationMinutes = 30) {
        try {
            if (!TempUserData) return;

            const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);
            await TempUserData.destroy({ where: { email } });
            await TempUserData.create({
                email,
                data: userData,
                expires_at: expiresAt,
            });
        } catch (error) {
            logger.error('Error saving temp user data:', error);
        }
    }

    /**
     * Obtener datos temporales del usuario
     */
    async getTempUserData(email) {
        try {
            if (!TempUserData) return null;

            const tempData = await TempUserData.findOne({
                where: {
                    email,
                    expires_at: { [Op.gt]: new Date() },
                },
            });

            return tempData ? tempData.data : null;
        } catch (error) {
            logger.error('Error getting temp user data:', error);
            return null;
        }
    }

    /**
     * Eliminar datos temporales del usuario
     */
    async deleteTempUserData(email) {
        try {
            if (!TempUserData) return;
            await TempUserData.destroy({ where: { email } });
        } catch (error) {
            logger.error('Error deleting temp user data:', error);
        }
    }

    // ============================================
    // MÉTODOS DE EMAIL
    // ============================================

    /**
     * Enviar email con código de verificación
     */
    async sendVerificationCodeEmail(email, code, name) {
        try {
            if (!emailService.isServiceAvailable || !emailService.isServiceAvailable()) {
                logger.warn('Email service not available');
                return;
            }

            // Aquí puedes implementar el envío del email con el código
            // Por ahora solo logueamos
            logger.info(`Would send verification code ${code} to ${email} for ${name}`);
        } catch (error) {
            logger.error('Error sending verification code email:', error);
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