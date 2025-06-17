const config = require('../../config/config.json');
const { connect } = require('../../includes/database');
const logger = require('../../includes/logger');

module.exports = {
    name: "balance",
    version: "1.0.0",
    author: "Hridoy",
    description: "Shows the balance of the command user, a mentioned user, or the top 10 balance holders.",
    adminOnly: false,
    commandCategory: "economy",
    guide: "Use {pn}balance to see your balance, {pn}balance @user to see their balance, or {pn}balance top for the top 10 balance holders.",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        if (!event || !event.threadID || !event.messageID) {
            console.error("Invalid event object in balance command");
            return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, event.threadID);
        }

        const db = await connect();
        const usersCollection = db.collection('users');

        if (args.length > 0 && args[0].toLowerCase() === "top") {
            const topUsers = await usersCollection
                .find({ ban: { $ne: true } })
                .sort({ balance: -1 })
                .limit(10)
                .toArray();

            if (topUsers.length === 0) {
                return api.sendMessage(`${config.bot.botName}: No users found.`, event.threadID);
            }

            const userList = await Promise.all(topUsers.map(async (user, index) => {
                const userInfo = await new Promise((resolve) => api.getUserInfo(user.userId, (err, info) => resolve(err ? {} : info)));
                const userName = userInfo[user.userId]?.name || user.userId;
                return `${index + 1}. ${userName} - ${user.balance || 0}`;
            }));

            return api.sendMessage(`${config.bot.botName}: Top 10 Balance Holders:\n${userList.join('\n')}`, event.threadID);
        }

        let targetUid;
        let targetName = "User";

        if (args.length > 0 && event.mentions && Object.keys(event.mentions).length > 0) {
            targetUid = Object.keys(event.mentions)[0];
            targetName = event.mentions[targetUid].replace(/@/g, '');
        } else {
            targetUid = event.senderID;
            const userInfo = await new Promise((resolve) => {
                api.getUserInfo(targetUid, (err, info) => resolve(err ? {} : info));
            });
            targetName = userInfo[targetUid]?.name || "User";
        }

        const user = await usersCollection.findOne({ userId: targetUid });
        if (!user) {
            return api.sendMessage(`${config.bot.botName}: ⚠️ User not found in database.`, event.threadID);
        }

        const balance = user.balance || 0;
        api.sendMessage(`${config.bot.botName}: ${targetName}'s balance: ${balance}`, event.threadID);
    }
};