const fs = require("fs");
const path = require("path");
const colors = require("colors");

module.exports = async (client) => {
  try {
    if (!client) {
      throw new Error('Cliente no proporcionado al handler de eventos');
    }

    const eventsPath = path.join(__dirname, "..", "events");
    const eventsDir = fs.readdirSync(eventsPath, { withFileTypes: true });

    let eventosRegistrados = 0;

    for (const item of eventsDir) {
      if (item.isDirectory()) {
        // Si es un directorio, lee los archivos dentro de él
        const nestedPath = path.join(eventsPath, item.name);
        const nestedDir = fs.readdirSync(nestedPath);
        
        for (const nestedFile of nestedDir) {
          if (!nestedFile.endsWith('.js')) continue;

          const eventPath = path.join(nestedPath, nestedFile);
          try {
            const event = require(eventPath);
            
            if (!event.name || typeof event.run !== 'function') {
              console.warn(`[WARN]`.yellow + ` Evento en ${nestedFile} no tiene 'name' o 'run'`);
              continue;
            }

            client.on(event.name, (...args) => event.run(client, ...args));
            eventosRegistrados++;
          } catch (error) {
            console.error(`[ERROR]`.red + ` cargando evento ${nestedFile}: ${error.message}`.red);
          }
        }
      } else if (item.isFile() && item.name.endsWith('.js')) {
        // Si es un archivo JS, importa el evento
        const eventPath = path.join(eventsPath, item.name);
        try {
          const event = require(eventPath);
          
          if (!event.name || typeof event.run !== 'function') {
            console.warn(`[WARN]`.yellow + ` Evento en ${item.name} no tiene 'name' o 'run'`);
            continue;
          }

          client.on(event.name, (...args) => event.run(client, ...args));
          eventosRegistrados++;
        } catch (error) {
          console.error(`[ERROR]`.red + ` cargando evento ${item.name}: ${error.message}`.red);
        }
      }
    }

    console.log(`✅ ${eventosRegistrados} evento(s) registrado(s) correctamente`.green);

  } catch (error) {
    console.error("[ERROR]".red + ` en handler de eventos: ${error.message}`.red);
    console.error(error.stack);
  }
};
