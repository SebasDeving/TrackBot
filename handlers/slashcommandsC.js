const fs = require('fs');
const path = require('path');
const colors = require('colors');
const { Collection } = require('discord.js');

module.exports = (client) => {
  try {
    if (!client) {
      console.error('[ERROR]'.red + ' Cliente no proporcionado');
      return;
    }

    // Crear la colección para los slash commands
    client.slashCommands = new Collection();

    const commandFolder = path.join(__dirname, '..', 'comandos_slash');

    if (!fs.existsSync(commandFolder)) {
      console.warn('[WARN]'.yellow + ' La carpeta de comandos slash no existe');
      return;
    }

    loadSlashCommands(commandFolder, client.slashCommands);

    if (client.slashCommands.size === 0) {
      console.warn('[WARN]'.yellow + ' No se cargaron comandos slash');
    } else {
      console.log(`✅ ${client.slashCommands.size} comando(s) slash cargado(s) en la colección`.green);
    }
  } catch (error) {
    console.error('[ERROR]'.red + ' en handler de slash commands:'.red);
    console.error(error.message);
  }
};

function loadSlashCommands(folderPath, collection) {
  try {
    const files = fs.readdirSync(folderPath, { withFileTypes: true });

    for (const item of files) {
      if (item.isDirectory()) {
        // Si es un directorio, cargar los comandos dentro de él recursivamente
        loadSlashCommands(path.join(folderPath, item.name), collection);
      } else if (item.isFile() && item.name.endsWith('.js')) {
        // Si es un archivo JS, cargar el comando
        const commandPath = path.join(folderPath, item.name);
        
        try {
          const command = require(commandPath);
          
          if (!command.data || !command.data.name) {
            console.warn(`[WARN]`.yellow + ` El comando ${item.name} no tiene estructura válida (falta 'data.name')`);
            continue;
          }

          if (typeof command.execute !== 'function' && typeof command.run !== 'function') {
            console.warn(`[WARN]`.yellow + ` El comando ${command.data.name} no tiene función 'execute' o 'run'`);
          }

          collection.set(command.data.name, command);
          console.log(`✓ Comando: ${command.data.name}`.gray);
        } catch (error) {
          console.error(`[ERROR]`.red + ` cargando comando ${item.name}: ${error.message}`.red);
        }
      }
    }
  } catch (error) {
    console.error(`[ERROR]`.red + ` leyendo carpeta ${folderPath}: ${error.message}`.red);
  }
}
