const { sequelize, testConnection } = require('../config/database');
const logger = require('../utils/logger');

// Importar modelos principales (siempre disponibles)
const User = require('../models/User');
const Role = require('../models/Role');
const ActivityLog = require('../models/ActivityLog');

// Importar modelos de verificación (nuevos)
let VerificationCode, TempUserData;
try {
    VerificationCode = require('../models/VerificationCode');
    TempUserData = require('../models/TempUserData');
    logger.info('✅ Verification models loaded successfully');
} catch (error) {
    logger.warn('⚠️  Verification models not found, enhanced features disabled:', error.message);
}

// Modelos opcionales (para futuros módulos)
const optionalModels = {};

try {
    optionalModels.Portfolio = require('../models/Portfolio');
    optionalModels.Program = require('../models/Program');
    optionalModels.Project = require('../models/Project');
    optionalModels.Document = require('../models/Document');
    optionalModels.DocumentVersion = require('../models/DocumentVersion');
    optionalModels.DocumentApproval = require('../models/DocumentApproval');
    optionalModels.Task = require('../models/Task');
    optionalModels.TaskAssignment = require('../models/TaskAssignment');
    optionalModels.Meeting = require('../models/Meeting');
    optionalModels.MeetingParticipant = require('../models/MeetingParticipant');
    optionalModels.Notification = require('../models/Notification');
    optionalModels.ProjectStatusLog = require('../models/ProjectStatusLog');
    logger.info('ℹ️  Optional models loaded:', Object.keys(optionalModels));
} catch (error) {
    logger.info('ℹ️  Some optional models not available yet (this is normal)');
}

// Función para establecer asociaciones
function setupAssociations() {
    try {
        logger.info('🔗 Setting up model associations...');

        // === ASOCIACIONES PRINCIPALES (SIEMPRE DISPONIBLES) ===

        // Relaciones User - Role
        User.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });
        Role.hasMany(User, { foreignKey: 'role_id', as: 'users' });

        // Relaciones ActivityLog - User
        ActivityLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
        User.hasMany(ActivityLog, { foreignKey: 'user_id', as: 'activityLogs' });

        // === ASOCIACIONES DE VERIFICACIÓN (SI ESTÁN DISPONIBLES) ===
        // Los modelos VerificationCode y TempUserData no necesitan FK explícitas
        // Se relacionan por email, no por foreign keys

        // === ASOCIACIONES OPCIONALES (SOLO SI LOS MODELOS EXISTEN) ===

        // Relaciones Portfolio - User
        if (optionalModels.Portfolio) {
            optionalModels.Portfolio.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
            User.hasMany(optionalModels.Portfolio, { foreignKey: 'created_by', as: 'portfolios' });
        }

        // Relaciones Program - Portfolio - User
        if (optionalModels.Program && optionalModels.Portfolio) {
            optionalModels.Program.belongsTo(optionalModels.Portfolio, { foreignKey: 'portfolio_id', as: 'portfolio' });
            optionalModels.Portfolio.hasMany(optionalModels.Program, { foreignKey: 'portfolio_id', as: 'programs' });
            optionalModels.Program.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
            User.hasMany(optionalModels.Program, { foreignKey: 'created_by', as: 'programs' });
        }

        // Relaciones Project - Program - User
        if (optionalModels.Project && optionalModels.Program) {
            optionalModels.Project.belongsTo(optionalModels.Program, { foreignKey: 'program_id', as: 'program' });
            optionalModels.Program.hasMany(optionalModels.Project, { foreignKey: 'program_id', as: 'projects' });
            optionalModels.Project.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
            User.hasMany(optionalModels.Project, { foreignKey: 'created_by', as: 'projects' });
        }

        // Relaciones Document - Project - User
        if (optionalModels.Document && optionalModels.Project) {
            optionalModels.Document.belongsTo(optionalModels.Project, { foreignKey: 'project_id', as: 'project' });
            optionalModels.Project.hasMany(optionalModels.Document, { foreignKey: 'project_id', as: 'documents' });
            optionalModels.Document.belongsTo(User, { foreignKey: 'uploaded_by', as: 'uploader' });
            User.hasMany(optionalModels.Document, { foreignKey: 'uploaded_by', as: 'documents' });
        }

        // Relaciones DocumentVersion - Document
        if (optionalModels.DocumentVersion && optionalModels.Document) {
            optionalModels.DocumentVersion.belongsTo(optionalModels.Document, { foreignKey: 'document_id', as: 'document' });
            optionalModels.Document.hasMany(optionalModels.DocumentVersion, { foreignKey: 'document_id', as: 'versions' });
        }

        // Relaciones DocumentApproval - DocumentVersion - User
        if (optionalModels.DocumentApproval && optionalModels.DocumentVersion) {
            optionalModels.DocumentApproval.belongsTo(optionalModels.DocumentVersion, { foreignKey: 'document_version_id', as: 'documentVersion' });
            optionalModels.DocumentVersion.hasMany(optionalModels.DocumentApproval, { foreignKey: 'document_version_id', as: 'approvals' });
            optionalModels.DocumentApproval.belongsTo(User, { foreignKey: 'approved_by', as: 'approver' });
            User.hasMany(optionalModels.DocumentApproval, { foreignKey: 'approved_by', as: 'approvals' });
        }

        // Relaciones Task - Project
        if (optionalModels.Task && optionalModels.Project) {
            optionalModels.Task.belongsTo(optionalModels.Project, { foreignKey: 'project_id', as: 'project' });
            optionalModels.Project.hasMany(optionalModels.Task, { foreignKey: 'project_id', as: 'tasks' });
        }

        // Relaciones TaskAssignment - Task - User
        if (optionalModels.TaskAssignment && optionalModels.Task) {
            optionalModels.TaskAssignment.belongsTo(optionalModels.Task, { foreignKey: 'task_id', as: 'task' });
            optionalModels.Task.hasMany(optionalModels.TaskAssignment, { foreignKey: 'task_id', as: 'assignments' });
            optionalModels.TaskAssignment.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
            User.hasMany(optionalModels.TaskAssignment, { foreignKey: 'user_id', as: 'taskAssignments' });
        }

        // Relaciones Meeting - Project - User
        if (optionalModels.Meeting && optionalModels.Project) {
            optionalModels.Meeting.belongsTo(optionalModels.Project, { foreignKey: 'project_id', as: 'project' });
            optionalModels.Project.hasMany(optionalModels.Meeting, { foreignKey: 'project_id', as: 'meetings' });
            optionalModels.Meeting.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
            User.hasMany(optionalModels.Meeting, { foreignKey: 'created_by', as: 'meetings' });
        }

        // Relaciones MeetingParticipant - Meeting - User
        if (optionalModels.MeetingParticipant && optionalModels.Meeting) {
            optionalModels.MeetingParticipant.belongsTo(optionalModels.Meeting, { foreignKey: 'meeting_id', as: 'meeting' });
            optionalModels.Meeting.hasMany(optionalModels.MeetingParticipant, { foreignKey: 'meeting_id', as: 'participants' });
            optionalModels.MeetingParticipant.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
            User.hasMany(optionalModels.MeetingParticipant, { foreignKey: 'user_id', as: 'meetingParticipations' });
        }

        // Relaciones Notification - User
        if (optionalModels.Notification) {
            optionalModels.Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
            User.hasMany(optionalModels.Notification, { foreignKey: 'user_id', as: 'notifications' });
        }

        // Relaciones ProjectStatusLog - Project
        if (optionalModels.ProjectStatusLog && optionalModels.Project) {
            optionalModels.ProjectStatusLog.belongsTo(optionalModels.Project, { foreignKey: 'project_id', as: 'project' });
            optionalModels.Project.hasMany(optionalModels.ProjectStatusLog, { foreignKey: 'project_id', as: 'statusLogs' });
        }

        logger.info('✅ Model associations established successfully');
    } catch (error) {
        logger.error('❌ Error establishing model associations:', error);
        throw error;
    }
}

// Función principal para conectar a la base de datos
async function connectDatabase() {
    try {
        logger.info('🔗 Connecting to database...');

        // Probar conexión
        const connected = await testConnection();
        if (!connected) {
            throw new Error('Could not establish database connection');
        }

        // Establecer asociaciones
        setupAssociations();

        // Sincronizar modelos solo en desarrollo
        if (process.env.NODE_ENV === 'development') {
            await sequelize.sync({ alter: false });
            logger.info('✅ Database synchronized (development mode)');
        }

        // Limpiar datos expirados al iniciar (solo si los modelos existen)
        try {
            if (VerificationCode && typeof VerificationCode.cleanupExpired === 'function') {
                const expiredCodes = await VerificationCode.cleanupExpired();
                if (expiredCodes > 0) {
                    logger.info(`🧹 Cleaned up ${expiredCodes} expired verification codes`);
                }
            }

            if (TempUserData && typeof TempUserData.cleanupExpired === 'function') {
                const expiredData = await TempUserData.cleanupExpired();
                if (expiredData > 0) {
                    logger.info(`🧹 Cleaned up ${expiredData} expired temp user data`);
                }
            }
        } catch (cleanupError) {
            logger.warn('⚠️  Could not cleanup expired data:', cleanupError.message);
        }

        return sequelize;
    } catch (error) {
        logger.error('❌ Database connection failed:', error);
        throw error;
    }
}

// Función para cerrar la conexión
async function closeConnection() {
    try {
        await sequelize.close();
        logger.info('✅ Database connection closed successfully');
    } catch (error) {
        logger.error('❌ Error closing database connection:', error);
        throw error;
    }
}

// Función para verificar el estado de los modelos de verificación
function checkVerificationModels() {
    const modelsStatus = {
        VerificationCode: !!VerificationCode,
        TempUserData: !!TempUserData,
        enhancedFeaturesAvailable: !!(VerificationCode && TempUserData),
    };

    logger.info('📊 Verification models status:', modelsStatus);
    return modelsStatus;
}

// Función de utilidad para obtener estadísticas de la base de datos
async function getDatabaseStats() {
    try {
        const stats = {
            users: await User.count(),
            roles: await Role.count(),
            activityLogs: await ActivityLog.count(),
        };

        // Agregar stats de verificación si están disponibles
        if (VerificationCode) {
            stats.verificationCodes = await VerificationCode.count();
            stats.activeVerificationCodes = await VerificationCode.count({
                where: {
                    used: false,
                    expires_at: { [sequelize.Sequelize.Op.gt]: new Date() }
                }
            });
        }

        if (TempUserData) {
            stats.tempUserData = await TempUserData.count();
            stats.activeTempUserData = await TempUserData.count({
                where: {
                    expires_at: { [sequelize.Sequelize.Op.gt]: new Date() }
                }
            });
        }

        // Agregar stats opcionales si están disponibles
        if (optionalModels.Project) {
            stats.projects = await optionalModels.Project.count();
        }

        return stats;
    } catch (error) {
        logger.error('Error getting database stats:', error);
        return null;
    }
}

module.exports = {
    connectDatabase,
    closeConnection,
    sequelize,
    checkVerificationModels,
    getDatabaseStats,
};