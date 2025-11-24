require('dotenv').config();
process.on('warning', e => console.warn(e.stack));
require("colors");
const fs = require('fs');

const Discord = require("discord.js");

const client = new Discord.Client({
    intents: 130767,
    partials: ["MESSAGE", "CHANNEL", "REACTION"]
});

// ============================
//         CONFIGS
// ============================
client.configs = require("./configs.js").configs;

// ============================
//     CARGAR BASE DE DATOS
// ============================
const connectToDatabase = require("./database/connect.js");
const { query, pool } = connectToDatabase();   // <-- CORREGIDO ✔

client.db = { query, pool };  // acceso global a la BD

// ============================
//           LOADERS
// ============================
const Loader = async () => {

    require("./handlers/slashcommandsC.js")(client);
    require("./handlers/slashcommands.js")(client);
    require("./handlers/events.js")(client);

    // LOGIN
    client.login(client.configs.token)
        .catch((error) => console.log("[ERROR] ".cyan + `${error.stack}`.red));
};

Loader();
