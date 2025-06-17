const config = require('../../config/config.json');

module.exports = {
    name: "unsend",
    version: "1.1.0",
    author: "Hridoy",
    description: "Unsends a bot message when replied to.",
    adminOnly: false,
    commandCategory: "utility",
    guide: "Use .unsend while replying to a bot message to delete it.",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event }) {
        if (!event || !event.threadID || !event.messageID) {
            console.error("Invalid event object in unsend command");
            return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, event.threadID);
        }

        if (event.type !== "message_reply") {
            return api.sendMessage(`${config.bot.botName}: ⚠️ Please reply to a bot message to unsend it.`, event.threadID, event.messageID);
        }

        if (!event.messageReply || event.messageReply.senderID !== api.getCurrentUserID()) {
            return api.sendMessage(`${config.bot.botName}: ⚠️ You can only unsend bot messages!`, event.threadID, event.messageID);
        }

        try {
            await api.unsendMessage(event.messageReply.messageID);
            console.log(`✅ Message unsent: ${event.messageReply.messageID}`);
        } catch (error) {
            console.error("❌ Error unsending message:", error);
            api.sendMessage(`${config.bot.botName}: ❌ Failed to unsend the message.`, event.threadID, event.messageID);
        }
    }
};
