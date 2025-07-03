const express = require('express');
const router = express.Router();

// Importar controladores
const authController = require('../controllers/authController');

// Importar middlewares
const { authenticate, requireEmailVerification } = require('../middleware/authMiddleware');
const { validate, authSchemas, paramSchemas } = require('../middleware/validateMiddleware');

/**
 * @route   POST /api/auth/register
 * @desc    Registrar un nuevo usuario
 * @access  Public
 */
router.post('/register',
    validate(authSchemas.register),
    authController.register
);

/**
 * @route   POST /api/auth/login
 * @desc    Iniciar sesión
 * @access  Public
 */
router.post('/login',
    validate(authSchemas.login),
    authController.login
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Renovar token de acceso
 * @access  Public
 */
router.post('/refresh',
    validate(authSchemas.refreshToken),
    authController.refreshToken
);

/**
 * @route   POST /api/auth/logout
 * @desc    Cerrar sesión
 * @access  Private
 */
router.post('/logout',
    authenticate,
    authController.logout
);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Solicitar reset de contraseña
 * @access  Public
 */
router.post('/forgot-password',
    validate(authSchemas.forgotPassword),
    authController.forgotPassword
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Restablecer contraseña
 * @access  Public
 */
router.post('/reset-password',
    validate(authSchemas.resetPassword),
    authController.resetPassword
);

/**
 * @route   POST /api/auth/change-password
 * @desc    Cambiar contraseña del usuario autenticado
 * @access  Private
 */
router.post('/change-password',
    authenticate,
    validate(authSchemas.changePassword),
    authController.changePassword
);

/**
 * @route   GET /api/auth/verify-email/:token
 * @desc    Verificar email del usuario
 * @access  Public
 */
router.get('/verify-email/:token',
    validate(paramSchemas.token, 'params'),
    authController.verifyEmail
);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Reenviar email de verificación
 * @access  Private
 */
router.post('/resend-verification',
    authenticate,
    authController.resendVerificationEmail
);

/**
 * @route   GET /api/auth/profile
 * @desc    Obtener perfil del usuario autenticado
 * @access  Private
 */
router.get('/profile',
    authenticate,
    authController.getProfile
);

/**
 * @route   PUT /api/auth/profile
 * @desc    Actualizar perfil del usuario autenticado
 * @access  Private
 */
router.put('/profile',
    authenticate,
    validate(authSchemas.updateProfile),
    authController.updateProfile
);

/**
 * @route   GET /api/auth/verify-token
 * @desc    Verificar si el token actual es válido
 * @access  Private
 */
router.get('/verify-token',
    authenticate,
    authController.verifyToken
);

/**
 * @route   GET /api/auth/me
 * @desc    Obtener información del usuario autenticado (alias para /profile)
 * @access  Private
 */
router.get('/me',
    authenticate,
    authController.getProfile
);

module.exports = router;