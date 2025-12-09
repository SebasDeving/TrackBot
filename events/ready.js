const Table = require('cli-table3');
const colors = require('colors');

module.exports = {
    name: "ready",
    run: async (client) => {
        try {
            // Validar que el cliente está listo
            if (!client || !client.user) {
                throw new Error('Cliente no inicializado correctamente');
            }

            // Calcular totales
            const totalServers = client.guilds.cache.size;
            const totalUsers = client.guilds.cache.reduce(
                (acc, guild) => acc + guild.memberCount, 
                0
            );
            const totalChannels = client.guilds.cache.reduce(
                (acc, guild) => acc + guild.channels.cache.size,
                0
            );

            // Configurar presencia del bot
            await client.user.setPresence({
                status: "online",
                afk: false,
                activities: [
                    {
                        name: `@Nilrats`,
                        type: 'WATCHING',
                    }
                ]
            });

            // Mostrar información en consola
            const table = new Table();
            table.push(
                { 'Nombre del Bot': client.user.tag },
                { 'Servidores': totalServers },
                { 'Usuarios': totalUsers },
                { 'Canales': totalChannels }
            );

            console.log('\n' + table.toString());
            console.log(`\n✅ Bot iniciado correctamente como ${client.user.tag}`.green);

        } catch (error) {
            console.error("[ERROR]".red + ` en evento ready: ${error.message}`.red);
            console.error(error.stack);
        }
    }
};
