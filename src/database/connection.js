const { sequelize, testConnection } = require('../config/database');
const logger = require('../utils/logger');

// Importar todos los modelos
const User = require('../models/User');
const Role = require('../models/Role');
/*const Portfolio = require('../models/Portfolio');
const Program = require('../models/Program');
const Project = require('../models/Project');
const Document = require('../models/Document');
const DocumentVersion = require('../models/DocumentVersion');
const DocumentApproval = require('../models/DocumentApproval');
const Task = require('../models/Task');
const TaskAssignment = require('../models/TaskAssignment');
const Meeting = require('../models/Meeting');
const MeetingParticipant = require('../models/MeetingParticipant');
const Notification = require('../models/Notification');
const ProjectStatusLog = require('../models/ProjectStatusLog');
const ActivityLog = require('../models/ActivityLog');
 */

// Función para establecer asociaciones
function setupAssociations() {
    try {
        // Relaciones User - Role
        User.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });
        Role.hasMany(User, { foreignKey: 'role_id', as: 'users' });

        // Relaciones Portfolio - User
        /*Portfolio.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
        User.hasMany(Portfolio, { foreignKey: 'created_by', as: 'portfolios' });

        // Relaciones Program - Portfolio - User
        Program.belongsTo(Portfolio, { foreignKey: 'portfolio_id', as: 'portfolio' });
        Portfolio.hasMany(Program, { foreignKey: 'portfolio_id', as: 'programs' });
        Program.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
        User.hasMany(Program, { foreignKey: 'created_by', as: 'programs' });

        // Relaciones Project - Program - User
        Project.belongsTo(Program, { foreignKey: 'program_id', as: 'program' });
        Program.hasMany(Project, { foreignKey: 'program_id', as: 'projects' });
        Project.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
        User.hasMany(Project, { foreignKey: 'created_by', as: 'projects' });

        // Relaciones Document - Project - User
        Document.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
        Project.hasMany(Document, { foreignKey: 'project_id', as: 'documents' });
        Document.belongsTo(User, { foreignKey: 'uploaded_by', as: 'uploader' });
        User.hasMany(Document, { foreignKey: 'uploaded_by', as: 'documents' });

        // Relaciones DocumentVersion - Document
        DocumentVersion.belongsTo(Document, { foreignKey: 'document_id', as: 'document' });
        Document.hasMany(DocumentVersion, { foreignKey: 'document_id', as: 'versions' });

        // Relaciones DocumentApproval - DocumentVersion - User
        DocumentApproval.belongsTo(DocumentVersion, { foreignKey: 'document_version_id', as: 'documentVersion' });
        DocumentVersion.hasMany(DocumentApproval, { foreignKey: 'document_version_id', as: 'approvals' });
        DocumentApproval.belongsTo(User, { foreignKey: 'approved_by', as: 'approver' });
        User.hasMany(DocumentApproval, { foreignKey: 'approved_by', as: 'approvals' });

        // Relaciones Task - Project
        Task.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
        Project.hasMany(Task, { foreignKey: 'project_id', as: 'tasks' });

        // Relaciones TaskAssignment - Task - User
        TaskAssignment.belongsTo(Task, { foreignKey: 'task_id', as: 'task' });
        Task.hasMany(TaskAssignment, { foreignKey: 'task_id', as: 'assignments' });
        TaskAssignment.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
        User.hasMany(TaskAssignment, { foreignKey: 'user_id', as: 'taskAssignments' });

        // Relaciones Meeting - Project - User
        Meeting.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
        Project.hasMany(Meeting, { foreignKey: 'project_id', as: 'meetings' });
        Meeting.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
        User.hasMany(Meeting, { foreignKey: 'created_by', as: 'meetings' });

        // Relaciones MeetingParticipant - Meeting - User
        MeetingParticipant.belongsTo(Meeting, { foreignKey: 'meeting_id', as: 'meeting' });
        Meeting.hasMany(MeetingParticipant, { foreignKey: 'meeting_id', as: 'participants' });
        MeetingParticipant.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
        User.hasMany(MeetingParticipant, { foreignKey: 'user_id', as: 'meetingParticipations' });

        // Relaciones Notification - User
        Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
        User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });

        // Relaciones ProjectStatusLog - Project
        ProjectStatusLog.belongsTo(Project, { foreignKey: 'project_id', as: 'project' });
        Project.hasMany(ProjectStatusLog, { foreignKey: 'project_id', as: 'statusLogs' });

        // Relaciones ActivityLog - User
        ActivityLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
        User.hasMany(ActivityLog, { foreignKey: 'user_id', as: 'activityLogs' });
         */

        logger.info('✅ Asociaciones de modelos establecidas correctamente');
    } catch (error) {
        logger.error('❌ Error al establecer asociaciones:', error);
        throw error;
    }
}

// Función principal para conectar a la base de datos
async function connectDatabase() {
    try {
        // Probar conexión
        const connected = await testConnection();
        if (!connected) {
            throw new Error('No se pudo establecer conexión con la base de datos');
        }

        // Establecer asociaciones
        setupAssociations();

        // Sincronizar modelos solo en desarrollo
        if (process.env.NODE_ENV === 'development') {
            await sequelize.sync({ alter: false });
            logger.info('✅ Base de datos sincronizada (desarrollo)');
        }

        return sequelize;
    } catch (error) {
        logger.error('❌ Error al conectar con la base de datos:', error);
        throw error;
    }
}

// Función para cerrar la conexión
async function closeConnection() {
    try {
        await sequelize.close();
        logger.info('✅ Conexión a la base de datos cerrada correctamente');
    } catch (error) {
        logger.error('❌ Error al cerrar la conexión:', error);
        throw error;
    }
}

module.exports = {
    connectDatabase,
    closeConnection,
    sequelize,
};