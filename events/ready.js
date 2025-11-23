const { MessageActionRow, MessageSelectMenu, MessageEmbed, MessageButton } = require('discord.js');
const MegaDB = require('megadb');
const Discord = require("discord.js");
const usersDB = new MegaDB.crearDB('usersDB');
const client = new Discord.Client({ intents: 130767, partials: ["MESSAGE", "CHANNEL", "REACTION"] });
client.nwhitelist = require("../configs.js").nwhitelist;

const connectToDatabase = require('../database/connect.js');
const { connection  } = connectToDatabase(client);


module.exports = {
    name: "ready",
    run: async (client) => {


        const Table = require('cli-table3');


        try {
           

            const totalChannels = client.guilds.cache.reduce(
                (acc, guild) => acc + guild.channels.cache.size,
                0
              );

            client.user.setPresence({
                status: "online",
                afk: false,
                activities: [
                    {
                        name: `@Nilrats`,
                        type: 'WATCHING',
                    }
                ]
            });

            const table = new Table();
            table.push(
              { 'Nombre del Bot': client.user.tag },
              { 'Servidores': client.guilds.cache.size },
              { 'Usuarios': client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0) },
              { 'Canales': totalChannels }
            );

            console.log(table.toString());

         } catch (error) {
            console.log("[ERROR] ".cyan + `${error.stack}`.red);
        }
    }
};