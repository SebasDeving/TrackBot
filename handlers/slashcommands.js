const fs = require('fs');
const path = require('path');
const colors = require('colors');

const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');

module.exports = (client) => {
  if (!client || !client.configs) {
    console.error('[ERROR]'.red + ' Cliente o configuración no proporcionados');
    return;
  }

  const { ClientId, token } = client.configs;

  if (!ClientId || !token) {
    console.error('[ERROR]'.red + ' ClientId o token no encontrados en la configuración');
    return;
  }

  const commands = [];
  const slashCommandsFolder = path.resolve(__dirname, '..', 'comandos_slash');

  // Cargar todos los comandos
  loadSlashCommands(slashCommandsFolder, commands);

  if (commands.length === 0) {
    console.warn('[WARN]'.yellow + ' No se encontraron comandos slash para registrar');
    return;
  }

  const rest = new REST({ version: '9' }).setToken(token);

  // Registrar comandos
  registerSlashCommands(rest, ClientId, commands);

  function loadSlashCommands(folderPath, commandsArray) {
    try {
      if (!fs.existsSync(folderPath)) {
        console.warn(`[WARN]`.yellow + ` La carpeta ${folderPath} no existe`);
        return;
      }

      const files = fs.readdirSync(folderPath);

      for (const file of files) {
        const filePath = path.join(folderPath, file);
        const stat = fs.lstatSync(filePath);

        if (stat.isDirectory()) {
          // Si es un directorio, cargar los comandos dentro de él recursivamente
          loadSlashCommands(filePath, commandsArray);
        } else if (file.endsWith('.js')) {
          // Si es un archivo JS, cargar el comando
          try {
            const slash = require(filePath);
            
            if (!slash.data || typeof slash.data.toJSON !== 'function') {
              console.warn(`[WARN]`.yellow + ` El comando ${file} no tiene estructura válida (falta 'data')`);
              continue;
            }

            commandsArray.push(slash.data.toJSON());
            console.log(`✓ Comando cargado: ${slash.data.name || file}`.gray);
          } catch (error) {
            console.error(`[ERROR]`.red + ` cargando comando ${file}: ${error.message}`.red);
          }
        }
      }
    } catch (error) {
      console.error(`[ERROR]`.red + ` leyendo carpeta ${folderPath}: ${error.message}`.red);
    }
  }

  async function registerSlashCommands(rest, clientId, commandsArray) {
    try {
      console.log(`\n📤 Registrando ${commandsArray.length} comando(s) slash...`.cyan);
      
      await rest.put(
        Routes.applicationCommands(clientId), 
        { body: commandsArray }
      );
      
      console.log(`✅ ${commandsArray.length} comando(s) slash registrado(s) correctamente\n`.green);
    } catch (error) {
      console.error('[ERROR]'.red + ' al registrar comandos slash:'.red);
      console.error(error.message);
      
      if (error.code === 50035) {
        console.error('Verifica que todos los comandos tengan estructura válida'.yellow);
      }
    }
  }
}
