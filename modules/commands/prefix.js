const config = require('../../config/config.json');
const { connect } = require('../../includes/database');

module.exports = {
    name: "prefix",
    version: "1.0.0",
    author: "Hridoy",
    description: "Shows bot info when the prefix is sent as a standalone message.",
    adminOnly: false,
    commandCategory: "utility",
    guide: "Send the bot's prefix (e.g., .) to see bot info.",
    cooldowns: 5,
    usePrefix: false, 

    async execute({ api, event, args }) {
        if (!event || !event.threadID || !event.messageID) {
            console.error("Invalid event object in prefix command");
            return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, event.threadID);
        }

        const db = await connect();
        const usersCollection = db.collection('users');
        const totalMembers = await usersCollection.countDocuments({ ban: { $ne: true } });

        const ownerInfo = await new Promise((resolve) => api.getUserInfo(config.bot.ownerUid, (err, info) => resolve(err ? {} : info)));
        const ownerName = ownerInfo[config.bot.ownerUid]?.name || "Unknown";

        const message = [
            `╔═━─[ ${config.bot.botName} INFO ]─━═╗`,
            `┃ 🎗️ Bot Name: ${config.bot.botName}`,
            `┃ 👨‍👩‍👧‍👦 Total Members: ${totalMembers}`,
            `┃ 👑 Owner: ${ownerName}`,
            `┃ ℹ️  Prefix: ${config.bot.prefix}`,
            `╚═━──────────────────────────────━═╝`
        ].join('\n');

        api.sendMessage(message, event.threadID);
    }
};