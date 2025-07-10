const authService = require('../services/authService');
const logger = require('../utils/logger');

class AuthController {
    /**
     * Registra un nuevo usuario
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async register(req, res) {
        try {
            const { name, email, password, role_id } = req.body;
            const clientIP = req.ip;
            const userAgent = req.headers['user-agent'];

            const result = await authService.register({
                name,
                email,
                password,
                role_id,
            });

            logger.info(`User registered successfully: ${email}`, {
                userId: result.user.id,
                email: result.user.email,
                ip: clientIP,
            });

            res.status(201).json({
                success: true,
                message: result.message,
                data: {
                    user: result.user,
                    tokens: result.tokens,
                },
            });
        } catch (error) {
            logger.error('Registration error:', error);

            res.status(400).json({
                success: false,
                error: error.message,
                code: 'REGISTRATION_ERROR',
            });
        }
    }

    /**
     * Autentica un usuario
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async login(req, res) {
        try {
            const { email, password } = req.body;
            const clientIP = req.ip;
            const userAgent = req.headers['user-agent'];

            const result = await authService.login(email, password, clientIP, userAgent);

            logger.info(`User logged in successfully: ${email}`, {
                userId: result.user.id,
                email: result.user.email,
                ip: clientIP,
            });

            res.json({
                success: true,
                message: result.message,
                data: {
                    user: result.user,
                    tokens: result.tokens,
                },
            });
        } catch (error) {
            logger.error('Login error:', error);

            // Determinar el código de estado basado en el tipo de error
            let statusCode = 400;
            if (error.message.includes('Credenciales inválidas')) {
                statusCode = 401;
            } else if (error.message.includes('Usuario inactivo')) {
                statusCode = 403;
            } else if (error.message.includes('Cuenta bloqueada')) {
                statusCode = 429;
            }

            res.status(statusCode).json({
                success: false,
                error: error.message,
                code: 'LOGIN_ERROR',
            });
        }
    }

    /**
     * Renueva el token de acceso
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async refreshToken(req, res) {
        try {
            const { refreshToken } = req.body;

            const result = await authService.refreshToken(refreshToken);

            logger.info('Token refreshed successfully', {
                userId: req.user?.id,
            });

            res.json({
                success: true,
                message: result.message,
                data: {
                    tokens: result.tokens,
                },
            });
        } catch (error) {
            logger.error('Token refresh error:', error);

            res.status(401).json({
                success: false,
                error: error.message,
                code: 'TOKEN_REFRESH_ERROR',
            });
        }
    }

    /**
     * Cierra la sesión del usuario
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async logout(req, res) {
        try {
            const userId = req.user.id;

            const result = await authService.logout(userId);

            logger.info('User logged out successfully', {
                userId,
                email: req.user.email,
            });

            res.json({
                success: true,
                message: result.message,
            });
        } catch (error) {
            logger.error('Logout error:', error);

            res.status(500).json({
                success: false,
                error: 'Error al cerrar sesión',
                code: 'LOGOUT_ERROR',
            });
        }
    }

    /**
     * Solicita el reset de contraseña
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async forgotPassword(req, res) {
        try {
            const { email } = req.body;

            const result = await authService.requestPasswordReset(email);

            logger.info('Password reset requested', {
                email,
                ip: req.ip,
            });

            res.json({
                success: true,
                message: result.message,
            });
        } catch (error) {
            logger.error('Forgot password error:', error);

            res.status(500).json({
                success: false,
                error: 'Error al procesar solicitud',
                code: 'FORGOT_PASSWORD_ERROR',
            });
        }
    }

    /**
     * Restablece la contraseña del usuario
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async resetPassword(req, res) {
        try {
            const { token, password } = req.body;

            const result = await authService.resetPassword(token, password);

            logger.info('Password reset successfully', {
                ip: req.ip,
            });

            res.json({
                success: true,
                message: result.message,
            });
        } catch (error) {
            logger.error('Reset password error:', error);

            res.status(400).json({
                success: false,
                error: error.message,
                code: 'RESET_PASSWORD_ERROR',
            });
        }
    }

    /**
     * Cambia la contraseña del usuario autenticado
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async changePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;
            const userId = req.user.id;

            const result = await authService.changePassword(userId, currentPassword, newPassword);

            logger.info('Password changed successfully', {
                userId,
                email: req.user.email,
            });

            res.json({
                success: true,
                message: result.message,
            });
        } catch (error) {
            logger.error('Change password error:', error);

            res.status(400).json({
                success: false,
                error: error.message,
                code: 'CHANGE_PASSWORD_ERROR',
            });
        }
    }

    /**
     * Verifica el email del usuario
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async verifyEmail(req, res) {
        try {
            const { token } = req.params;

            const result = await authService.verifyEmail(token);

            logger.info('Email verified successfully', {
                token: token.substring(0, 8) + '...',
            });

            res.json({
                success: true,
                message: result.message,
            });
        } catch (error) {
            logger.error('Email verification error:', error);

            res.status(400).json({
                success: false,
                error: error.message,
                code: 'EMAIL_VERIFICATION_ERROR',
            });
        }
    }

    /**
     * Obtiene el perfil del usuario autenticado
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async getProfile(req, res) {
        try {
            const userId = req.user.id;

            const result = await authService.getProfile(userId);

            res.json({
                success: true,
                data: {
                    user: result.user,
                },
            });
        } catch (error) {
            logger.error('Get profile error:', error);

            res.status(500).json({
                success: false,
                error: 'Error al obtener perfil',
                code: 'GET_PROFILE_ERROR',
            });
        }
    }

    /**
     * Actualiza el perfil del usuario autenticado
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async updateProfile(req, res) {
        try {
            const userId = req.user.id;
            const updateData = req.body;

            const result = await authService.updateProfile(userId, updateData);

            logger.info('Profile updated successfully', {
                userId,
                email: req.user.email,
            });

            res.json({
                success: true,
                message: result.message,
                data: {
                    user: result.user,
                },
            });
        } catch (error) {
            logger.error('Update profile error:', error);

            res.status(400).json({
                success: false,
                error: error.message,
                code: 'UPDATE_PROFILE_ERROR',
            });
        }
    }

    /**
     * Verifica el estado del token actual
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async verifyToken(req, res) {
        try {
            // Si llegamos aquí, el token es válido (verificado por el middleware)
            res.json({
                success: true,
                message: 'Token válido',
                data: {
                    user: {
                        id: req.user.id,
                        name: req.user.name,
                        email: req.user.email,
                        roleName: req.user.roleName,
                        isActive: req.user.isActive,
                        emailVerified: req.user.emailVerified,
                    },
                },
            });
        } catch (error) {
            logger.error('Token verification error:', error);

            res.status(401).json({
                success: false,
                error: 'Token inválido',
                code: 'INVALID_TOKEN',
            });
        }
    }

    /**
     * Reenvía el email de verificación
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async resendVerificationEmail(req, res) {
        try {
            const userId = req.user.id;

            // Obtener el usuario para verificar si ya está verificado
            const { user } = await authService.getProfile(userId);

            if (user.email_verified) {
                return res.status(400).json({
                    success: false,
                    error: 'El email ya está verificado',
                    code: 'EMAIL_ALREADY_VERIFIED',
                });
            }

            // Reenviar email de verificación
            await authService.sendVerificationEmail(user);

            logger.info('Verification email resent', {
                userId,
                email: user.email,
            });

            res.json({
                success: true,
                message: 'Email de verificación enviado',
            });
        } catch (error) {
            logger.error('Resend verification email error:', error);

            res.status(500).json({
                success: false,
                error: 'Error al reenviar email de verificación',
                code: 'RESEND_VERIFICATION_ERROR',
            });
        }
    }
}

module.exports = new AuthController();