const config = require('../../config/config.json');
const { connect } = require('../../includes/database');
const logger = require('../../includes/logger');

module.exports = {
    name: "bet",
    version: "1.0.0",
    author: "Hridoy",
    description: "Bet an amount of your balance on a coin flip (heads or tails). Win to double your bet, lose to lose it.",
    adminOnly: false,
    commandCategory: "economy",
    guide: "Use {pn}bet <amount> <heads/tails> to place a bet.\n" +
           "Example: {pn}bet 100 heads",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        try {
            if (!event || !event.threadID || !event.messageID) {
                logger.error("Invalid event object in bet command", { event });
                return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, event.threadID);
            }

            const threadID = event.threadID;
            const messageID = event.messageID;
            const userID = event.senderID;


            if (args.length !== 2) {
                return api.sendMessage(
                    `${config.bot.botName}: Usage: {pn}bet <amount> <heads/tails>\nExample: {pn}bet 100 heads`,
                    threadID,
                    messageID
                );
            }

            const betAmount = parseInt(args[0]);
            const userChoice = args[1].toLowerCase();


            if (isNaN(betAmount) || betAmount <= 0) {
                return api.sendMessage(
                    `${config.bot.botName}: Please enter a valid bet amount greater than 0.`,
                    threadID,
                    messageID
                );
            }


            if (!["heads", "tails"].includes(userChoice)) {
                return api.sendMessage(
                    `${config.bot.botName}: Please choose either 'heads' or 'tails'.`,
                    threadID,
                    messageID
                );
            }


            const db = await connect();
            const usersCollection = db.collection('users');


            const user = await usersCollection.findOne({ userId: userID });
            if (!user) {
                return api.sendMessage(
                    `${config.bot.botName}: ⚠️ You are not found in the database. Please interact with the bot to register.`,
                    threadID,
                    messageID
                );
            }

            const currentBalance = user.balance || 0;


            if (currentBalance < betAmount) {
                return api.sendMessage(
                    `${config.bot.botName}: You don't have enough balance to place this bet. Your balance: ${currentBalance}`,
                    threadID,
                    messageID
                );
            }


            const coinResult = Math.random() < 0.5 ? "heads" : "tails";
            const userWon = userChoice === coinResult;

            let newBalance;
            let resultMessage;

            if (userWon) {

                newBalance = currentBalance + betAmount;
                resultMessage = `${config.bot.botName}: The coin landed on **${coinResult}**! You won! 🎉\n` +
                               `You gained ${betAmount} (doubled your bet).\n` +
                               `New balance: ${newBalance}`;
            } else {
   
                newBalance = currentBalance - betAmount;
                resultMessage = `${config.bot.botName}: The coin landed on **${coinResult}**. You lost. 😢\n` +
                                `You lost your bet of ${betAmount}.\n` +
                                `New balance: ${newBalance}`;
            }

            await usersCollection.updateOne(
                { userId: userID },
                { $set: { balance: newBalance } }
            );


            await api.sendMessage(resultMessage, threadID, messageID);

            logger.info(`User ${userID} bet ${betAmount} on ${userChoice}, result: ${coinResult}, new balance: ${newBalance}`);
        } catch (error) {
            logger.error(`Error in bet execute: ${error.message}`, { event, args });
            try {
                await api.sendMessage(
                    `${config.bot.botName}: ❌ An error occurred while processing the bet command.`,
                    event.threadID,
                    event.messageID
                );
            } catch (sendErr) {
                logger.error(`Failed to send error message in execute: ${sendErr.message}`);
            }
        }
    }
};