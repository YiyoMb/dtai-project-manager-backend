const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Importar middlewares personalizados
const { errorMiddleware, notFoundMiddleware } = require('./middleware/errorMiddleware');
const logger = require('./utils/logger');

// Importar rutas
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const roleRoutes = require('./routes/roles');

// Crear instancia de Express
const app = express();

// Configurar trust proxy para obtener IPs reales detrás de proxies
app.set('trust proxy', 1);

// Middleware de logging de requests
app.use((req, res, next) => {
    const startTime = Date.now();

    // Log de request
    logger.info(`📥 ${req.method} ${req.originalUrl}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        contentType: req.get('Content-Type'),
        userId: req.user?.id
    });

    // Log de response cuando termine
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logLevel = res.statusCode >= 400 ? 'warn' : 'info';

        logger[logLevel](`📤 ${req.method} ${req.originalUrl} - ${res.statusCode}`, {
            duration: `${duration}ms`,
            statusCode: res.statusCode,
            contentLength: res.get('Content-Length'),
            ip: req.ip,
            userId: req.user?.id
        });
    });

    next();
});

// Configuración de seguridad con Helmet
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://cdnjs.cloudflare.com",
                "https://fonts.googleapis.com"
            ],
            scriptSrc: [
                "'self'",
                "https://cdnjs.cloudflare.com"
            ],
            imgSrc: [
                "'self'",
                "data:",
                "https:",
                "blob:"
            ],
            fontSrc: [
                "'self'",
                "https://fonts.gstatic.com",
                "https://cdnjs.cloudflare.com"
            ],
            connectSrc: [
                "'self'",
                "https://api.github.com" // Para futuras integraciones
            ],
            mediaSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameSrc: ["'none'"]
        },
    },
    crossOriginEmbedderPolicy: false, // Permite embeds si es necesario
    hsts: {
        maxAge: 31536000, // 1 año
        includeSubDomains: true,
        preload: true
    }
}));

// Configuración de CORS
const corsOptions = {
    origin: function (origin, callback) {
        // Lista de orígenes permitidos
        const allowedOrigins = [
            process.env.FRONTEND_URL,
            process.env.ADMIN_URL,
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:3002',
            'http://localhost:5173', // Vite default
            'http://localhost:5174',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3001',
            'http://127.0.0.1:5173'
        ].filter(Boolean); // Remover valores undefined

        // Permitir requests sin origin (apps móviles, Postman, etc.)
        if (!origin) {
            return callback(null, true);
        }

        // Permitir orígenes en la lista
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            logger.warn(`🚫 CORS: Origin not allowed: ${origin}`);
            callback(new Error('No permitido por CORS'));
        }
    },
    credentials: true, // Permitir cookies y headers de autenticación
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Access-Control-Allow-Origin',
        'Access-Control-Allow-Headers',
        'Access-Control-Allow-Methods'
    ],
    exposedHeaders: [
        'X-Total-Count',
        'X-Page-Count',
        'X-Current-Page',
        'X-Per-Page',
        'X-Token-Expiring'
    ],
    maxAge: 86400 // 24 horas de cache para preflight
};

app.use(cors(corsOptions));

// Rate limiting configurado por rutas
const createRateLimiter = (windowMs, max, message) => {
    return rateLimit({
        windowMs,
        max,
        message: {
            error: message,
            code: 'RATE_LIMIT_EXCEEDED'
        },
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => {
            // Excluir health check del rate limiting
            return req.path === '/health';
        },
        keyGenerator: (req) => {
            // Usar IP y User-Agent para identificar clientes únicos
            return `${req.ip}-${req.get('User-Agent')}`;
        }
    });
};

// Rate limiting por tipo de endpoint
const authLimiter = createRateLimiter(
    15 * 60 * 1000, // 15 minutos
    10, // máximo 10 intentos de auth por ventana
    'Demasiados intentos de autenticación, intenta de nuevo más tarde'
);

const generalLimiter = createRateLimiter(
    15 * 60 * 1000, // 15 minutos
    100, // máximo 100 requests por ventana
    'Demasiadas peticiones desde esta IP, intenta de nuevo más tarde'
);

// Aplicar rate limiting
/*app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/', generalLimiter);
*/

// Middlewares para parsing de datos
app.use(express.json({
    limit: '10mb',
    strict: true,
    type: ['application/json', 'application/*+json']
}));

app.use(express.urlencoded({
    extended: true,
    limit: '10mb',
    parameterLimit: 1000
}));

// Middleware para parsear texto plano (útil para webhooks)
app.use(express.text({ type: 'text/plain' }));

// Servir archivos estáticos
const uploadsPath = path.join(__dirname, '../uploads');
const publicPath = path.join(__dirname, '../public');

app.use('/uploads', express.static(uploadsPath, {
    maxAge: '1d', // Cache por 1 día
    etag: true,
    lastModified: true
}));

app.use('/public', express.static(publicPath, {
    maxAge: '7d', // Cache por 7 días para recursos estáticos
    etag: true,
    lastModified: true
}));

// Health check endpoint (sin autenticación)
app.get('/health', (req, res) => {
    const healthCheck = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0',
        memory: process.memoryUsage(),
        database: 'connected', // TODO: Implementar check real de DB
        services: {
            auth: 'operational',
            email: process.env.SMTP_HOST ? 'configured' : 'not_configured'
        }
    };

    res.status(200).json(healthCheck);
});

// Endpoint de información de la API
app.get('/api', (req, res) => {
    res.json({
        name: 'DTAI Project Manager API',
        version: '1.0.0',
        description: 'API para gestión de proyectos DTAI',
        status: 'running',
        timestamp: new Date().toISOString(),
        endpoints: {
            auth: '/api/auth',
            users: '/api/users',
            roles: '/api/roles',
            health: '/health'
        },
        documentation: {
            postman: '/public/postman-collection.json',
            swagger: '/api/docs' // Para futuro
        },
        support: {
            email: 'dev-team@dtai.com',
            repository: 'https://github.com/dtai/project-manager'
        }
    });
});

// Middleware para agregar headers de información
app.use((req, res, next) => {
    res.setHeader('X-API-Version', '1.0.0');
    res.setHeader('X-Powered-By', 'DTAI Project Manager');
    next();
});

// Rutas principales de la API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);

// Endpoint para verificar que la API está funcionando
app.get('/ping', (req, res) => {
    res.json({
        message: 'pong',
        timestamp: new Date().toISOString(),
        server: 'DTAI Project Manager'
    });
});

// Middleware para manejar rutas no encontradas
app.use(notFoundMiddleware);

// Middleware de manejo de errores (debe ir al final)
app.use(errorMiddleware);

// Manejo de eventos de la aplicación
app.on('error', (error) => {
    logger.error('❌ Application error:', error);
});

// Exportar la aplicación
module.exports = app;