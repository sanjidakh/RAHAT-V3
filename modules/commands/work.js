const config = require('../../config/config.json');
const { connect } = require('../../includes/database');
const logger = require('../../includes/logger');

module.exports = {
    name: "work",
    version: "1.0.0",
    author: "Hridoy",
    description: "Earn a random amount of currency (15/20/25) once every 24 hours.",
    adminOnly: false,
    commandCategory: "economy",
    guide: "Use {pn}work to earn currency once every 24 hours.",
    cooldowns: 0,
    usePrefix: true,

    async execute({ api, event, args }) {
        if (!event || !event.threadID || !event.messageID) {
            console.error("Invalid event object in work command");
            return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, event.threadID);
        }

        const db = await connect();
        const usersCollection = db.collection('users');

        const user = await usersCollection.findOne({ userId: event.senderID });
        if (!user) {
            return api.sendMessage(`${config.bot.botName}: ⚠️ User not found in database.`, event.threadID);
        }

        const now = Date.now();
        const lastWork = user.lastWork || 0;
        const cooldown = 24 * 60 * 60 * 1000; 

        if (now - lastWork < cooldown) {
            const timeLeft = Math.ceil((cooldown - (now - lastWork)) / (60 * 60 * 1000));
            return api.sendMessage(`${config.bot.botName}: ⚠️ You can only work once every 24 hours. Try again in ${timeLeft} hours.`, event.threadID);
        }

        const amounts = [15, 20, 25];
        const earnedAmount = amounts[Math.floor(Math.random() * amounts.length)];
        const newBalance = (user.balance || 0) + earnedAmount;

        await usersCollection.updateOne(
            { userId: event.senderID },
            { $set: { balance: newBalance, lastWork: now } }
        );

        logger.info(`User ${event.senderID} worked and earned ${earnedAmount}. New balance: ${newBalance}`);
        api.sendMessage(`${config.bot.botName}: ✅ You worked and earned ${earnedAmount}! Your new balance is ${newBalance}.`, event.threadID);
    }
};