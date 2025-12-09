require('dotenv').config();
require("colors");

// Manejo de advertencias y errores no capturados
process.on('warning', (warning) => {
    console.warn('[WARNING]'.yellow + ` ${warning.name}: ${warning.message}`);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[ERROR]'.red + ' Promesa rechazada no manejada:'.red);
    console.error(reason);
});

process.on('uncaughtException', (error) => {
    console.error('[ERROR FATAL]'.red + ' Excepción no capturada:'.red);
    console.error(error.stack);
    process.exit(1);
});

const Discord = require("discord.js");

// ============================
//      CREAR CLIENTE
// ============================
const client = new Discord.Client({
    intents: 130767,
    partials: ["MESSAGE", "CHANNEL", "REACTION"]
});

// ============================
//         CONFIGS
// ============================
try {
    client.configs = require("./configs.js").configs;
    
    if (!client.configs || !client.configs.token) {
        throw new Error('Configuración inválida: falta el token del bot');
    }
} catch (error) {
    console.error('[ERROR FATAL]'.red + ' No se pudo cargar la configuración:'.red);
    console.error(error.message);
    process.exit(1);
}

// ============================
//     CARGAR BASE DE DATOS
// ============================
try {
    const connectToDatabase = require("./database/connect.js");
    const { query, pool } = connectToDatabase();
    
    if (!query || !pool) {
        throw new Error('Conexión a la base de datos falló');
    }
    
    client.db = { query, pool };
    console.log('✅ Base de datos conectada'.green);
} catch (error) {
    console.error('[ERROR]'.red + ' No se pudo conectar a la base de datos:'.red);
    console.error(error.message);
    console.warn('[WARN]'.yellow + ' El bot continuará sin base de datos');
    client.db = null;
}

// ============================
//           LOADERS
// ============================
const Loader = async () => {
    try {
        console.log('\n📦 Cargando handlers...\n'.cyan);

        // Cargar comandos y eventos
        await require("./handlers/slashcommandsC.js")(client);
        await require("./handlers/slashcommands.js")(client);
        await require("./handlers/events.js")(client);

        console.log('\n🔐 Iniciando sesión...'.cyan);

        // LOGIN
        await client.login(client.configs.token);
        
    } catch (error) {
        console.error('[ERROR FATAL]'.red + ' Error al inicializar el bot:'.red);
        console.error(error.stack);
        process.exit(1);
    }
};

// Iniciar el bot
Loader().catch((error) => {
    console.error('[ERROR FATAL]'.red + ' Error en Loader:'.red);
    console.error(error.stack);
    process.exit(1);
});
