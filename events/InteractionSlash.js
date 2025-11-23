const { MessageEmbed } = require('discord.js');

module.exports = {
  name: 'interactionCreate',
  run: async (client, interaction) => {
    try {
      if (interaction.isCommand()) {
        const slashCmd = client.slashCommands.get(interaction.commandName);

        if (!slashCmd) return;

        try {
          await slashCmd.run(interaction);
        } catch (e) {
          console.error(e);
        }
      }else{
        return;
      }
    } catch (error) {
      console.error(`[Error]`.red + `EVENTO> interactionSlash`.yellow);
      console.error(error);
      interaction.reply({ content: 'Ha ocurrido un error al procesar tu interacción.', ephemeral: true });
    }
  },
};
