const fs = require('fs');
const path = require('path');
const Discord = require('discord.js');

module.exports = (client) => {
  // Crear la colección para los slash commands
  client.slashCommands = new Discord.Collection();

  const commandFolder = path.join(__dirname, '..', 'comandos_slash');
  loadSlashCommands(commandFolder, client.slashCommands);

  console.log("[BOT] ".cyan + `${client.slashCommands.size} Comandos Slash cargados`.green);
};

function loadSlashCommands(folderPath, collection) {
  const files = fs.readdirSync(folderPath, { withFileTypes: true });

  for (const item of files) {
    if (item.isDirectory()) {
      // Si es un directorio, cargar los comandos dentro de él
      loadSlashCommands(path.join(folderPath, item.name), collection);
    } else if (item.isFile() && item.name.endsWith('.js')) {
      // Si es un archivo JS, cargar el comando
      const command = require(path.join(folderPath, item.name));
      collection.set(command.data.name, command);
      //   console.log(`Slash command - ${command.data.name} cargado.`);
    }
  }
}
