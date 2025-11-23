const { MessageEmbed } = require('discord.js');

module.exports = {
  name: 'interactionCreate',
  run: async (client, interaction) => {
    try {

      // Solo procesar comandos slash
      if (!interaction.isCommand()) return;

      const slashCmd = client.slashCommands.get(interaction.commandName);
      if (!slashCmd) return;

      try {
        await slashCmd.run(interaction);
      } catch (e) {
        console.error("❌ Error ejecutando slash command:", e);

        // Evitar que falle si ya respondimos antes
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '⚠️ Ocurrió un error al ejecutar este comando.',
            ephemeral: true
          });
        }
      }

    } catch (error) {
      console.error("❌ Error en evento interactionCreate:", error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '⚠️ Ha ocurrido un error al procesar tu interacción.',
          ephemeral: true
        });
      }
    }
  },
};
