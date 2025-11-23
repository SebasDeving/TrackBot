
process.on('warning', e => console.warn(e.stack));
require("colors");
const fs = require('fs');

const Discord = require("discord.js");

const client = new Discord.Client({ intents: 130767, partials: ["MESSAGE", "CHANNEL", "REACTION"] });


client.configs = require("./configs.js").configs;


const Loader = async () => {

    await require("./database/connect.js")(client);
    require("./handlers/slashcommandsC.js")(client);
    require("./handlers/slashcommands.js")(client);
    require("./handlers/events.js")(client);

    client.login(client.configs.token).catch((error) => console.log("[ERROR] ".cyan + `${error.stack}`.red));
};
Loader();