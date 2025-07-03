const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
    constructor() {
        //this.transporter = null;
        //this.initializeTransporter();
        logger.info('📧 Email service disabled - not initializing transporter');
    }

    /**
     * Inicializa el transportador de email
     */
    initializeTransporter() {
        try {
            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: process.env.SMTP_PORT || 587,
                secure: false, // true para 465, false para otros puertos
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });

            // Verificar conexión
            this.transporter.verify((error, success) => {
                if (error) {
                    logger.error('Email service initialization failed:', error);
                } else {
                    logger.info('Email service initialized successfully');
                }
            });
        } catch (error) {
            logger.error('Failed to initialize email transporter:', error);
        }
    }

    /**
     * Envía un email
     * @param {Object} options - Opciones del email
     * @returns {Promise} Resultado del envío
     */
    async sendEmail(options) {
        try {
            if (!this.transporter) {
                throw new Error('Email transporter not initialized');
            }

            const mailOptions = {
                from: `${process.env.FROM_NAME || 'DTAI Project Manager'} <${process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
                to: options.to,
                subject: options.subject,
                html: options.html,
                text: options.text,
            };

            const result = await this.transporter.sendMail(mailOptions);
            logger.info('Email sent successfully', {
                to: options.to,
                subject: options.subject,
                messageId: result.messageId,
            });

            return result;
        } catch (error) {
            logger.error('Email sending failed:', error);
            throw error;
        }
    }

    /**
     * Envía email de verificación
     * @param {string} email - Email del usuario
     * @param {string} token - Token de verificación
     */
    async sendVerificationEmail(email, token) {
        try {
            const verificationUrl = `${process.env.APP_URL}/api/auth/verify-email/${token}`;

            const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Verificación de Email</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #007bff; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background: #f9f9f9; }
            .button { display: inline-block; padding: 12px 30px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>DTAI Project Manager</h1>
            </div>
            <div class="content">
              <h2>Verifica tu email</h2>
              <p>Hola,</p>
              <p>Gracias por registrarte en DTAI Project Manager. Para completar tu registro, por favor verifica tu dirección de email haciendo clic en el siguiente botón:</p>
              <a href="${verificationUrl}" class="button">Verificar Email</a>
              <p>Si el botón no funciona, puedes copiar y pegar el siguiente enlace en tu navegador:</p>
              <p>${verificationUrl}</p>
              <p>Este enlace expirará en 24 horas por seguridad.</p>
            </div>
            <div class="footer">
              <p>Si no solicitaste esta verificación, puedes ignorar este email.</p>
              <p>&copy; 2025 DTAI Project Manager. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
        </html>
      `;

            const text = `
        Verifica tu email - DTAI Project Manager
        
        Hola,
        
        Gracias por registrarte en DTAI Project Manager. Para completar tu registro, por favor verifica tu dirección de email visitando el siguiente enlace:
        
        ${verificationUrl}
        
        Este enlace expirará en 24 horas por seguridad.
        
        Si no solicitaste esta verificación, puedes ignorar este email.
      `;

            await this.sendEmail({
                to: email,
                subject: 'Verifica tu email - DTAI Project Manager',
                html,
                text,
            });
        } catch (error) {
            logger.error('Failed to send verification email:', error);
            throw error;
        }
    }

    /**
     * Envía email de reset de contraseña
     * @param {string} email - Email del usuario
     * @param {string} token - Token de reset
     */
    async sendPasswordResetEmail(email, token) {
        try {
            const resetUrl = `${process.env.FRONTEND_URL || process.env.APP_URL}/reset-password?token=${token}`;

            const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Restablecer Contraseña</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc3545; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background: #f9f9f9; }
            .button { display: inline-block; padding: 12px 30px; background: #dc3545; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 5px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>DTAI Project Manager</h1>
            </div>
            <div class="content">
              <h2>Restablecer contraseña</h2>
              <p>Hola,</p>
              <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta. Si fuiste tú quien hizo esta solicitud, haz clic en el siguiente botón:</p>
              <a href="${resetUrl}" class="button">Restablecer Contraseña</a>
              <p>Si el botón no funciona, puedes copiar y pegar el siguiente enlace en tu navegador:</p>
              <p>${resetUrl}</p>
              <div class="warning">
                <strong>Importante:</strong> Este enlace expirará en 1 hora por seguridad.
              </div>
            </div>
            <div class="footer">
              <p>Si no solicitaste el restablecimiento de contraseña, puedes ignorar este email de forma segura.</p>
              <p>&copy; 2025 DTAI Project Manager. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
        </html>
      `;

            const text = `
        Restablecer contraseña - DTAI Project Manager
        
        Hola,
        
        Recibimos una solicitud para restablecer la contraseña de tu cuenta. Si fuiste tú quien hizo esta solicitud, visita el siguiente enlace:
        
        ${resetUrl}
        
        Este enlace expirará en 1 hora por seguridad.
        
        Si no solicitaste el restablecimiento de contraseña, puedes ignorar este email de forma segura.
      `;

            await this.sendEmail({
                to: email,
                subject: 'Restablecer contraseña - DTAI Project Manager',
                html,
                text,
            });
        } catch (error) {
            logger.error('Failed to send password reset email:', error);
            throw error;
        }
    }

    /**
     * Envía email de bienvenida
     * @param {string} email - Email del usuario
     * @param {string} name - Nombre del usuario
     */
    async sendWelcomeEmail(email, name) {
        try {
            const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Bienvenido a DTAI Project Manager</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #28a745; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background: #f9f9f9; }
            .button { display: inline-block; padding: 12px 30px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
            .features { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>¡Bienvenido a DTAI Project Manager!</h1>
            </div>
            <div class="content">
              <h2>Hola ${name},</h2>
              <p>¡Bienvenido a DTAI Project Manager! Tu cuenta ha sido creada exitosamente y ya puedes comenzar a gestionar tus proyectos.</p>
              
              <div class="features">
                <h3>¿Qué puedes hacer ahora?</h3>
                <ul>
                  <li>Gestionar portafolios, programas y proyectos</li>
                  <li>Subir y aprobar documentos</li>
                  <li>Organizar tareas con el tablero Kanban</li>
                  <li>Programar reuniones con tu equipo</li>
                  <li>Visualizar el progreso en dashboards</li>
                </ul>
              </div>
              
              <a href="${process.env.FRONTEND_URL || process.env.APP_URL}" class="button">Comenzar Ahora</a>
            </div>
            <div class="footer">
              <p>Si tienes alguna pregunta, no dudes en contactar al administrador del sistema.</p>
              <p>&copy; 2025 DTAI Project Manager. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
        </html>
      `;

            const text = `
        ¡Bienvenido a DTAI Project Manager!
        
        Hola ${name},
        
        ¡Bienvenido a DTAI Project Manager! Tu cuenta ha sido creada exitosamente y ya puedes comenzar a gestionar tus proyectos.
        
        ¿Qué puedes hacer ahora?
        - Gestionar portafolios, programas y proyectos
        - Subir y aprobar documentos
        - Organizar tareas con el tablero Kanban
        - Programar reuniones con tu equipo
        - Visualizar el progreso en dashboards
        
        Visita: ${process.env.FRONTEND_URL || process.env.APP_URL}
        
        Si tienes alguna pregunta, no dudes en contactar al administrador del sistema.
      `;

            await this.sendEmail({
                to: email,
                subject: '¡Bienvenido a DTAI Project Manager!',
                html,
                text,
            });
        } catch (error) {
            logger.error('Failed to send welcome email:', error);
            throw error;
        }
    }

    /**
     * Envía notificación por email
     * @param {string} email - Email del usuario
     * @param {string} subject - Asunto del email
     * @param {string} message - Mensaje
     * @param {Object} options - Opciones adicionales
     */
    async sendNotificationEmail(email, subject, message, options = {}) {
        try {
            const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${subject}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #17a2b8; color: white; padding: 20px; text-align: center; }
            .content { padding: 30px; background: #f9f9f9; }
            .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
            .notification { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #17a2b8; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>DTAI Project Manager</h1>
            </div>
            <div class="content">
              <h2>${subject}</h2>
              <div class="notification">
                <p>${message}</p>
              </div>
              ${options.actionUrl ? `<a href="${options.actionUrl}" style="display: inline-block; padding: 12px 30px; background: #17a2b8; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">${options.actionText || 'Ver Detalles'}</a>` : ''}
            </div>
            <div class="footer">
              <p>Esta es una notificación automática del sistema.</p>
              <p>&copy; 2025 DTAI Project Manager. Todos los derechos reservados.</p>
            </div>
          </div>
        </body>
        </html>
      `;

            const text = `
        ${subject}
        
        ${message}
        
        ${options.actionUrl ? `Ver detalles: ${options.actionUrl}` : ''}
        
        Esta es una notificación automática del sistema.
        DTAI Project Manager
      `;

            await this.sendEmail({
                to: email,
                subject: `[DTAI] ${subject}`,
                html,
                text,
            });
        } catch (error) {
            logger.error('Failed to send notification email:', error);
            throw error;
        }
    }

    /**
     * Verifica la configuración del servicio de email
     * @returns {Promise<boolean>} True si la configuración es válida
     */
    async verifyConfiguration() {
        try {
            if (!this.transporter) {
                return false;
            }

            await this.transporter.verify();
            return true;
        } catch (error) {
            logger.error('Email configuration verification failed:', error);
            return false;
        }
    }
}

module.exports = new EmailService();