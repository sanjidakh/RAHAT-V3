const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const { connect } = require('../../includes/database');

module.exports = {
    name: "adminonly",
    version: "1.0.0",
    author: "Hridoy",
    description: "Toggles admin-only mode for the bot. When enabled, only admins can use bot commands.",
    adminOnly: true, 
    commandCategory: "admin",
    guide: "Use {pn}adminonly on/off to enable or disable admin-only mode.",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        try {
            if (!event || !event.threadID || !event.messageID) {
                logger.error("Invalid event object in adminonly command", { event });
                return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, event.threadID);
            }

            const threadID = event.threadID;
            const messageID = event.messageID;

            if (!args.length || !["on", "off"].includes(args[0].toLowerCase())) {
                return api.sendMessage(
                    `${config.bot.botName}: Usage: {pn}adminonly on/off`,
                    threadID,
                    event.messageID
                );
            }

            const db = await connect();
            const settingsCollection = db.collection('settings');
            const mode = args[0].toLowerCase() === "on" ? true : false;

       
            await settingsCollection.updateOne(
                { setting: "adminOnlyMode" },
                { $set: { value: mode } },
                { upsert: true }
            );

            const statusMessage = mode
                ? "Admin-only mode has been enabled. Only admins can use bot commands."
                : "Admin-only mode has been disabled. Everyone can use bot commands.";

            await api.sendMessage(
                `${config.bot.botName}: ${statusMessage}`,
                threadID,
                event.messageID
            );

            logger.info(`Admin-only mode set to ${mode ? 'enabled' : 'disabled'} by ${event.senderID}`);
        } catch (error) {
            logger.error(`Error in adminonly execute: ${error.message}`, { event, args });
            try {
                await api.sendMessage(
                    `${config.bot.botName}: ❌ An error occurred while processing the adminonly command.`,
                    event.threadID,
                    event.messageID
                );
            } catch (sendErr) {
                logger.error(`Failed to send error message in execute: ${sendErr.message}`);
            }
        }
    }
};