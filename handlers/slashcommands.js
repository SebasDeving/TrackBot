const Discord = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Discord.Client({ intents: 130767, partials: ["MESSAGE", "CHANNEL", "REACTION"] });
client.configs = require('../configs.js').configs;

const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');

const ClientId = client.configs.ClientId;

const commands = [];

module.exports = (client) => {
  const slashCommandsFolder = path.resolve(__dirname, '..', 'comandos_slash');
  loadSlashCommands(slashCommandsFolder);

  const rest = new REST({ version: '9' }).setToken(client.configs.token);

  createSlash();

  async function createSlash() {
    try {
      await rest.put(Routes.applicationCommands(ClientId), { body: commands });
      console.log("[BOT] ".cyan + `Todos los slashcommands fueron recargados`.green);
    } catch (error) {
      console.error(error);
    }
  }
}

function loadSlashCommands(folderPath) {
  const files = fs.readdirSync(folderPath);

  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const stat = fs.lstatSync(filePath);

    if (stat.isDirectory()) {
      // Si es un directorio, cargar los comandos dentro de él
      loadSlashCommands(filePath);
    } else if (file.endsWith('.js')) {
      // Si es un archivo JS, cargar el comando
      const slash = require(filePath);
      commands.push(slash.data.toJSON());
    }
  }
}
