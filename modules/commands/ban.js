const config = require('../../config/config.json');
const { connect } = require('../../includes/database');
const logger = require('../../includes/logger');

module.exports = {
    name: "ban",
    version: "1.0.0",
    author: "Hridoy",
    description: "Manages banned users (admin only).",
    adminOnly: true,
    commandCategory: "admin",
    guide: "Use {pn}ban list to see banned users, {pn}ban @user to ban, or {pn}ban remove @user to unban.",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        if (!event || !event.threadID || !event.messageID) {
            console.error("Invalid event object in ban command");
            return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, event.threadID);
        }

        const db = await connect();
        const usersCollection = db.collection('users');

        if (args.length === 0) {
            return api.sendMessage(`${config.bot.botName}: ⚠️ Invalid usage. ${this.guide}`, event.threadID);
        }

        if (args[0].toLowerCase() === "list") {
            const bannedUsers = await usersCollection.find({ ban: true }).toArray();
            if (bannedUsers.length === 0) {
                return api.sendMessage(`${config.bot.botName}: No users are currently banned.`, event.threadID);
            }
            const userList = await Promise.all(bannedUsers.map(async (user) => {
                const userInfo = await new Promise((resolve) => api.getUserInfo(user.userId, (err, info) => resolve(err ? {} : info)));
                const userName = userInfo[user.userId]?.name || user.userId;
                return `- ${userName} (ID: ${user.userId})`;
            }));
            return api.sendMessage(`${config.bot.botName}: Banned users:\n${userList.join('\n')}`, event.threadID);
        }

        if (!event.mentions || Object.keys(event.mentions).length === 0) {
            return api.sendMessage(`${config.bot.botName}: ⚠️ Please mention a user to ban or unban.`, event.threadID);
        }

        const targetUid = Object.keys(event.mentions)[0];
        const targetName = event.mentions[targetUid].replace(/@/g, '');
        const isRemove = args[0].toLowerCase() === "remove";

        await usersCollection.updateOne(
            { userId: targetUid },
            { $set: { ban: !isRemove } },
            { upsert: true }
        );

        const action = isRemove ? "unbanned" : "banned";
        logger.info(`${action} user ${targetUid} (${targetName})`);
        api.sendMessage(`${config.bot.botName}: ✅ ${targetName} has been ${action}.`, event.threadID);
    }
};