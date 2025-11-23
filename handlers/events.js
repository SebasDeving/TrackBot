const fs = require("fs");
const path = require("path");

module.exports = async (client) => {
  try {
    const eventsDir = await fs.readdirSync(path.join(__dirname, "..", "events"), { withFileTypes: true });

    for (const item of eventsDir) {
      if (item.isDirectory()) {
        // Si es un directorio, lee los archivos dentro de él
        const nestedDir = await fs.readdirSync(path.join(__dirname, "..", "events", item.name));
        for (const nestedFile of nestedDir) {
          const event = require(path.join(__dirname, "..", "events", item.name, nestedFile));
          client.on(event.name, (...args) => event.run(client, ...args));
        }
      } else if (item.isFile() && item.name.endsWith('.js')) {
        // Si es un archivo JS, importa el evento
        const event = require(path.join(__dirname, "..", "events", item.name));
        client.on(event.name, (...args) => event.run(client, ...args));
      }
    }
  } catch (error) {
    console.log("[ERROR] ".cyan + `${error.stack}`.red);
  }
};
