require('dotenv').config();
const { sequelize } = require('../../config/database');
const Role = require('../../models/Role');
const User = require('../../models/User');
const logger = require('../../utils/logger');

/**
 * Seed inicial para roles del sistema
 */
async function seedRoles() {
    try {
        const roles = [
            {
                name: 'superadministrador',
                description: 'Control total del sistema, gestión de usuarios y configuración global',
            },
            {
                name: 'administrador',
                description: 'Gestión de proyectos, programas y portafolios, aprobación de documentos',
            },
            {
                name: 'colaborador',
                description: 'Ejecución de tareas, creación de documentos, participación en proyectos',
            },
            {
                name: 'cliente',
                description: 'Visualización de proyectos, aprobación de documentos, acceso limitado',
            },
        ];

        for (const roleData of roles) {
            const [role, created] = await Role.findOrCreate({
                where: { name: roleData.name },
                defaults: roleData,
            });

            if (created) {
                logger.info(`Rol creado: ${role.name}`);
            } else {
                logger.info(`Rol ya existe: ${role.name}`);
            }
        }

        logger.info('✅ Roles seeded successfully');
    } catch (error) {
        logger.error('❌ Error seeding roles:', error);
        throw error;
    }
}

/**
 * Seed inicial para usuario superadministrador
 */
async function seedSuperAdmin() {
    try {
        // Buscar el rol de superadministrador
        const superAdminRole = await Role.findOne({
            where: { name: 'superadministrador' }
        });

        if (!superAdminRole) {
            throw new Error('Rol de superadministrador no encontrado');
        }

        // Crear usuario superadministrador por defecto
        const superAdminData = {
            name: 'Super Administrador',
            email: process.env.SUPER_ADMIN_EMAIL || 'admin@dtai.com',
            password: process.env.SUPER_ADMIN_PASSWORD || 'Admin123!',
            role_id: superAdminRole.id,
            is_active: true,
            email_verified: true,
        };

        const [user, created] = await User.findOrCreate({
            where: { email: superAdminData.email },
            defaults: superAdminData,
        });

        if (created) {
            logger.info(`✅ Usuario superadministrador creado: ${user.email}`);
            logger.info(`🔑 Contraseña por defecto: ${superAdminData.password}`);
            logger.warn('⚠️  IMPORTANTE: Cambia la contraseña por defecto después del primer login');
        } else {
            logger.info(`ℹ️  Usuario superadministrador ya existe: ${user.email}`);
        }

        logger.info('✅ Super admin seeded successfully');
    } catch (error) {
        logger.error('❌ Error seeding super admin:', error);
        throw error;
    }
}

/**
 * Seed de usuarios de ejemplo para desarrollo
 */
async function seedDevelopmentUsers() {
    if (process.env.NODE_ENV === 'production') {
        logger.info('ℹ️  Skipping development users in production');
        return;
    }

    try {
        // Obtener roles
        const adminRole = await Role.findOne({ where: { name: 'administrador' } });
        const collaboratorRole = await Role.findOne({ where: { name: 'colaborador' } });
        const clientRole = await Role.findOne({ where: { name: 'cliente' } });

        const developmentUsers = [
            {
                name: 'María García',
                email: 'admin@example.com',
                password: 'Admin123!',
                role_id: adminRole.id,
                is_active: true,
                email_verified: true,
            },
            {
                name: 'Carlos López',
                email: 'colaborador@example.com',
                password: 'Colaborador123!',
                role_id: collaboratorRole.id,
                is_active: true,
                email_verified: true,
            },
            {
                name: 'Ana Martínez',
                email: 'cliente@example.com',
                password: 'Cliente123!',
                role_id: clientRole.id,
                is_active: true,
                email_verified: true,
            },
        ];

        for (const userData of developmentUsers) {
            const [user, created] = await User.findOrCreate({
                where: { email: userData.email },
                defaults: userData,
            });

            if (created) {
                logger.info(`👤 Usuario de desarrollo creado: ${user.email} (${user.name})`);
            } else {
                logger.info(`ℹ️  Usuario de desarrollo ya existe: ${user.email}`);
            }
        }

        logger.info('✅ Development users seeded successfully');
    } catch (error) {
        logger.error('❌ Error seeding development users:', error);
        throw error;
    }
}

/**
 * Función principal de seeding
 */
async function runSeeders() {
    try {
        logger.info('🌱 Starting database seeding...');

        // Verificar conexión a la base de datos
        await sequelize.authenticate();
        logger.info('✅ Database connection verified');

        // Ejecutar seeders en orden
        await seedRoles();
        await seedSuperAdmin();
        await seedDevelopmentUsers();

        logger.info('🎉 Database seeding completed successfully!');

        // Mostrar resumen
        const totalUsers = await User.count();
        const totalRoles = await Role.count();

        logger.info(`📊 Seeding Summary:`);
        logger.info(`   - Roles: ${totalRoles}`);
        logger.info(`   - Users: ${totalUsers}`);

        if (process.env.NODE_ENV !== 'production') {
            logger.info('🔧 Development Environment - Test credentials:');
            logger.info('   - Superadmin: admin@dtai.com / Admin123!');
            logger.info('   - Admin: admin@example.com / Admin123!');
            logger.info('   - Colaborador: colaborador@example.com / Colaborador123!');
            logger.info('   - Cliente: cliente@example.com / Cliente123!');
        }

    } catch (error) {
        logger.error('❌ Database seeding failed:', error);
        throw error;
    }
}

/**
 * Función para limpiar datos de desarrollo
 */
async function clearDevelopmentData() {
    if (process.env.NODE_ENV === 'production') {
        logger.warn('⚠️  Cannot clear data in production environment');
        return;
    }

    try {
        logger.info('🧹 Clearing development data...');

        // Eliminar usuarios de desarrollo (excepto superadmin)
        const developmentEmails = [
            'admin@example.com',
            'colaborador@example.com',
            'cliente@example.com',
        ];

        await User.destroy({
            where: {
                email: developmentEmails,
            },
        });

        logger.info('✅ Development data cleared successfully');
    } catch (error) {
        logger.error('❌ Error clearing development data:', error);
        throw error;
    }
}

/**
 * Función para verificar integridad de datos
 */
async function verifyDataIntegrity() {
    try {
        logger.info('🔍 Verifying data integrity...');

        // Verificar que todos los roles existen
        const requiredRoles = ['superadministrador', 'administrador', 'colaborador', 'cliente'];
        const existingRoles = await Role.findAll({
            where: { name: requiredRoles },
            attributes: ['name'],
        });

        const existingRoleNames = existingRoles.map(role => role.name);
        const missingRoles = requiredRoles.filter(role => !existingRoleNames.includes(role));

        if (missingRoles.length > 0) {
            logger.warn(`⚠️  Missing roles: ${missingRoles.join(', ')}`);
        } else {
            logger.info('✅ All required roles exist');
        }

        // Verificar que existe al menos un superadministrador
        const superAdminRole = await Role.findOne({ where: { name: 'superadministrador' } });
        if (superAdminRole) {
            const superAdminCount = await User.count({
                where: {
                    role_id: superAdminRole.id,
                    is_active: true,
                },
            });

            if (superAdminCount === 0) {
                logger.warn('⚠️  No active superadministrator found');
            } else {
                logger.info(`✅ Found ${superAdminCount} active superadministrator(s)`);
            }
        }

        // Verificar usuarios sin roles válidos
        const usersWithoutValidRoles = await User.count({
            include: [{
                model: Role,
                as: 'role',
                required: false,
            }],
            where: {
                '$role.id': null,
            },
        });

        if (usersWithoutValidRoles > 0) {
            logger.warn(`⚠️  Found ${usersWithoutValidRoles} users without valid roles`);
        } else {
            logger.info('✅ All users have valid roles');
        }

        logger.info('✅ Data integrity verification completed');
    } catch (error) {
        logger.error('❌ Error verifying data integrity:', error);
        throw error;
    }
}

// Ejecutar según el argumento de línea de comandos
if (require.main === module) {
    const command = process.argv[2];

    const commands = {
        seed: runSeeders,
        clear: clearDevelopmentData,
        verify: verifyDataIntegrity,
    };

    if (command && commands[command]) {
        commands[command]()
            .then(() => {
                logger.info('✅ Command executed successfully');
                process.exit(0);
            })
            .catch((error) => {
                logger.error('❌ Command failed:', error);
                process.exit(1);
            });
    } else {
        logger.info('📋 Available commands:');
        logger.info('   npm run seed        - Run all seeders');
        logger.info('   node src/database/seeders/seed.js seed  - Run all seeders');
        logger.info('   node src/database/seeders/seed.js clear - Clear development data');
        logger.info('   node src/database/seeders/seed.js verify - Verify data integrity');

        runSeeders()
            .then(() => {
                logger.info('✅ Default seeding completed');
                process.exit(0);
            })
            .catch((error) => {
                logger.error('❌ Default seeding failed:', error);
                process.exit(1);
            });
    }
}

module.exports = {
    runSeeders,
    seedRoles,
    seedSuperAdmin,
    seedDevelopmentUsers,
    clearDevelopmentData,
    verifyDataIntegrity,
};