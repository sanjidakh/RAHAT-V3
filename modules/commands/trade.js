const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const { connect } = require('../../includes/database/index');
const axios = require('axios');

const tradeUpImages = [
    'https://i.ibb.co.com/9qG3YYS/tradeup0001.jpg',
    'https://i.ibb.co.com/1JkFVpt/tradeup0011.jpg',
    'https://i.ibb.co.com/g7tgZdc/tradeup0003.jpg',
    'https://i.ibb.co.com/7np8Jn7/tradeup0002.jpg',
    'https://i.ibb.co.com/YyvzmV1/tradeup0004.jpg',
    'https://i.ibb.co.com/GcBTGhr/tradeup0005.jpg',
    'https://i.ibb.co.com/W2vjrGs/tradeup0006.jpg',
    'https://i.ibb.co.com/Cz9T7HP/tradeup0007.jpg',
    'https://i.ibb.co.com/CtwNqbp/tradeup0008.jpg',
    'https://i.ibb.co.com/zrdtrrF/tradeup0013.jpg',
    'https://i.ibb.co.com/1GK7qjR/tradeup0012.jpg',
    'https://i.ibb.co.com/Sryh9Rj/tradeup0009.jpg',
    'https://i.ibb.co.com/ZBXpswF/tradeup0014.jpg',
    'https://i.ibb.co.com/DbsCCR9/tradeup0010.jpg'
];

const tradeDownImages = [
    'https://i.ibb.co.com/YDytHcX/tradedown0015.jpg',
    'https://i.ibb.co.com/bbKQkzG/tradedown0014.jpg',
    'https://i.ibb.co.com/9w7BQXL/tradedown0013.jpg',
    'https://i.ibb.co.com/6wM8jhd/tradedown0012.jpg',
    'https://i.ibb.co.com/58R8nc1/tradedown0011.jpg',
    'https://i.ibb.co.com/gmwjHvD/tradedown0010.jpg',
    'https://i.ibb.co.com/jL7c3XN/tradedown0009.jpg',
    'https://i.ibb.co.com/tcKgWWh/tradedown0008.jpg',
    'https://i.ibb.co.com/mcsXrWZ/tradedown0007.jpg',
    'https://i.ibb.co.com/cvMFtZv/tradedown0006.jpg',
    'https://i.ibb.co.com/LxYxD7m/tradedown0005.jpg',
    'https://i.ibb.co.com/yYgKyZy/tradedown0004.jpg',
    'https://i.ibb.co.com/PT2WBrK/tradedown0003.jpg',
    'https://i.ibb.co.com/P9BHhdP/tradedown0002.jpg',
    'https://i.ibb.co.com/0V0XWhB/tradedown0001.jpg'
];

async function sendMessageWithRetry(api, message, threadID, messageID, retries = 3, delay = 2000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await new Promise((resolve, reject) => {
                api.sendMessage(message, threadID, (err, info) => {
                    if (err) reject(err);
                    else resolve(info);
                }, messageID);
            });
        } catch (err) {
            logger.warn(`Attempt ${attempt} failed to send message: ${err.message}`);
            if (attempt === retries) throw err;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

function convertTime(ms) {
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    ms %= (24 * 60 * 60 * 1000);
    const hours = Math.floor(ms / (60 * 60 * 1000));
    ms %= (60 * 60 * 1000);
    const minutes = Math.floor(ms / (60 * 1000));
    ms %= (60 * 1000);
    const seconds = Math.floor(ms / 1000);
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

module.exports = {
    name: "trade",
    version: "1.0.3",
    author: "Hridoy",
    description: "A trading game where users predict market movements.",
    adminOnly: false,
    commandCategory: "games",
    guide: "Use {pn}trade up/down <amount> to place a trade\n{pn}trade top [page] to see leaderboard\n{pn}trade info [userID/@mention] to see user stats\n{pn}trade reset to reset leaderboard (admin only)\n{pn}trade setmoney @user <amount> to set user's money (admin only)",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        try {
            if (!event || !event.threadID || !event.messageID) {
                logger.error("Invalid event object in trade command", { event });
                return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, event.threadID);
            }

            const db = await connect();
            const tradeDataCollection = db.collection('trade');
            const threadID = event.threadID;
            const senderID = event.senderID;

            const adminIDs = config.bot.adminIDs || [];
            const isAdmin = adminIDs.includes(senderID);

            let userData = await tradeDataCollection.findOne({ userID: senderID });
            if (!userData) {
                userData = {
                    userID: senderID,
                    money: 1000,
                    tradesWon: [],
                    tradesLost: [],
                    totalProfit: 0
                };
                await tradeDataCollection.insertOne(userData);
            }

            if (args[0]?.toLowerCase() === "top") {
                const rankData = await tradeDataCollection.find({}).toArray();
                if (!rankData.length) {
                    return api.sendMessage(`${config.bot.botName}: No traders available.`, threadID, event.messageID);
                }

                const page = parseInt(args[1]) || 1;
                const maxUsersPerPage = 30;
                let rankDataHandle = await Promise.all(
                    rankData.slice((page - 1) * maxUsersPerPage, page * maxUsersPerPage).map(async item => {
                        const userInfo = await new Promise((resolve) => {
                            api.getUserInfo(item.userID, (err, info) => resolve(err ? {} : info));
                        });
                        return {
                            ...item,
                            userName: userInfo[item.userID]?.name || "Unknown User",
                            money: item.money || 0,
                            tradesWonCount: item.tradesWon?.length || 0,
                            tradesLostCount: item.tradesLost?.length || 0
                        };
                    })
                );

                rankDataHandle = rankDataHandle.sort((a, b) => b.money - a.money);
                const medals = ["🥇", "🥈", "🥉"];
                const rankText = rankDataHandle.map((item, index) => {
                    const medal = medals[index] || (index + 1);
                    return `${medal} ${item.userName} - ${item.money} coins (${item.tradesWonCount} wins, ${item.tradesLostCount} losses)`;
                }).join("\n");

                return api.sendMessage(
                    `${config.bot.botName}: Top Traders\n\n${rankText || "No traders available."}\n\nPage ${page} of ${Math.ceil(rankData.length / maxUsersPerPage)}`,
                    threadID,
                    event.messageID
                );
            } else if (args[0]?.toLowerCase() === "info") {
                let targetID;
                if (event.mentions && Object.keys(event.mentions).length) {
                    targetID = Object.keys(event.mentions)[0];
                } else if (event.messageReply) {
                    targetID = event.messageReply.senderID;
                } else if (!isNaN(args[1])) {
                    targetID = args[1];
                } else {
                    targetID = senderID;
                }

                const targetData = await tradeDataCollection.findOne({ userID: targetID });
                if (!targetData) {
                    return api.sendMessage(`${config.bot.botName}: User not found: ${targetID}`, threadID, event.messageID);
                }

                const userInfo = await new Promise((resolve) => {
                    api.getUserInfo(targetID, (err, info) => resolve(err ? {} : info));
                });
                const userName = userInfo[targetID]?.name || "Unknown User";
                const money = targetData.money || 0;
                const tradesWon = targetData.tradesWon?.length || 0;
                const tradesLost = targetData.tradesLost?.length || 0;
                const totalTrades = tradesWon + tradesLost;
                const winRate = totalTrades > 0 ? (tradesWon / totalTrades * 100).toFixed(2) : 0;
                const totalProfit = targetData.totalProfit || 0;
                const playTime = convertTime(
                    (targetData.tradesWon?.reduce((a, b) => a + b.timePlayed, 0) || 0) +
                    (targetData.tradesLost?.reduce((a, b) => a + b.timePlayed, 0) || 0)
                );

                return api.sendMessage(
                    `${config.bot.botName}: Stats for ${userName}\n` +
                    `Money: ${money} coins\n` +
                    `Total Trades: ${totalTrades}\n` +
                    `Trades Won: ${tradesWon}\n` +
                    `Trades Lost: ${tradesLost}\n` +
                    `Win Rate: ${winRate}%\n` +
                    `Total Profit: ${totalProfit} coins\n` +
                    `Total Play Time: ${playTime}`,
                    threadID,
                    event.messageID
                );
            } else if (args[0]?.toLowerCase() === "reset") {
                if (!isAdmin) {
                    return api.sendMessage(`${config.bot.botName}: ❌ You do not have permission to reset the leaderboard.`, threadID, event.messageID);
                }
                await tradeDataCollection.deleteMany({});
                return api.sendMessage(`${config.bot.botName}: ✅ Trading leaderboard reset successfully.`, threadID, event.messageID);
            } else if (args[0]?.toLowerCase() === "setmoney" && args[1] && event.mentions && Object.keys(event.mentions).length > 0) {
                if (!isAdmin) {
                    return api.sendMessage(`${config.bot.botName}: ❌ Only bot admins can set user money.`, threadID, event.messageID);
                }

                const mentionedUsers = Object.keys(event.mentions);
                if (mentionedUsers.length !== 1) {
                    return api.sendMessage(`${config.bot.botName}: Please mention exactly one user to set money.`, threadID, event.messageID);
                }

                const targetID = mentionedUsers[0];
                const targetName = event.mentions[targetID] || "User";
                const amount = parseInt(args[2]);

                if (isNaN(amount) || amount < 0) {
                    return api.sendMessage(`${config.bot.botName}: Please provide a valid non-negative amount.`, threadID, event.messageID);
                }

                await tradeDataCollection.updateOne(
                    { userID: targetID },
                    { $set: { money: amount } },
                    { upsert: true }
                );

                return api.sendMessage(
                    `${config.bot.botName}: ✅ Set ${targetName}'s money to ${amount} coins.`,
                    threadID,
                    event.messageID
                );
            }

            const prediction = args[0]?.toLowerCase();
            if (!["up", "down"].includes(prediction)) {
                return api.sendMessage(
                    `${config.bot.botName}: Please specify "up" or "down" (e.g., {pn}trade up 100).`,
                    threadID,
                    event.messageID
                );
            }

            const amount = parseInt(args[1]);
            if (isNaN(amount) || amount <= 0) {
                return api.sendMessage(
                    `${config.bot.botName}: Please provide a valid positive amount to trade.`,
                    threadID,
                    event.messageID
                );
            }

            if (amount > userData.money) {
                return api.sendMessage(
                    `${config.bot.botName}: You don't have enough money. Your balance: ${userData.money} coins.`,
                    threadID,
                    event.messageID
                );
            }

            const marketResult = Math.random() < 0.5 ? 'up' : 'down';
            const isWin = prediction === marketResult;
            const profitLoss = isWin ? amount : -amount;
            const newBalance = userData.money + profitLoss;

            const tradeRecord = { amount, timePlayed: Date.now(), date: new Date().toISOString() };
            const updateData = {
                money: newBalance,
                totalProfit: (userData.totalProfit || 0) + profitLoss
            };
            if (isWin) {
                updateData.tradesWon = [...(userData.tradesWon || []), tradeRecord];
            } else {
                updateData.tradesLost = [...(userData.tradesLost || []), tradeRecord];
            }

            await tradeDataCollection.updateOne(
                { userID: senderID },
                { $set: updateData },
                { upsert: true }
            );

            const userInfo = await new Promise((resolve) => {
                api.getUserInfo(senderID, (err, info) => resolve(err ? {} : info));
            });
            const userName = userInfo[senderID]?.name || "Trader";

      
            const imageUrl = marketResult === 'up'
                ? tradeUpImages[Math.floor(Math.random() * tradeUpImages.length)]
                : tradeDownImages[Math.floor(Math.random() * tradeDownImages.length)];

       
            let imageStream;
            try {
                const response = await axios.get(imageUrl, { responseType: 'stream' });
                imageStream = response.data;
            } catch (err) {
                logger.error(`Failed to fetch trade image from URL: ${err.message}`, { imageUrl });
                const fallbackText = `${config.bot.botName}: Trade Result\n` +
                    `Trader: ${userName}\n` +
                    `Prediction: ${prediction.toUpperCase()} (${amount} coins)\n` +
                    `Market: ${marketResult.toUpperCase()}\n` +
                    `Result: ${isWin ? 'WIN' : 'LOSS'}\n` +
                    `Profit/Loss: ${profitLoss >= 0 ? '+' : ''}${profitLoss} coins\n` +
                    `New Balance: ${newBalance} coins\n` +
                    `Note: Failed to load trade image.`;
                return api.sendMessage(fallbackText, threadID, event.messageID);
            }

    
            const resultText = `${config.bot.botName}: Trade Result\n` +
                `Trader: ${userName}\n` +
                `Prediction: ${prediction.toUpperCase()} (${amount} coins)\n` +
                `Market: ${marketResult.toUpperCase()}\n` +
                `Result: ${isWin ? 'WIN' : 'LOSS'}\n` +
                `Profit/Loss: ${profitLoss >= 0 ? '+' : ''}${profitLoss} coins\n` +
                `New Balance: ${newBalance} coins`;

            try {
                const info = await sendMessageWithRetry(
                    api,
                    {
                        body: resultText,
                        attachment: imageStream
                    },
                    threadID,
                    event.messageID,
                    3, 
                    2000
                );
                logger.info(`Trade result image sent: ${info.messageID}`);
            } catch (err) {
                logger.error(`Failed to send trade result image after retries: ${err.message}`);
                const fallbackText = resultText + `\nNote: Failed to send trade image due to timeout.`;
                await api.sendMessage(fallbackText, threadID, event.messageID);
            }
        } catch (error) {
            logger.error(`Error in trade execute: ${error.message}`, { event, args });
            try {
                await api.sendMessage(
                    `${config.bot.botName}: ❌ An error occurred while processing the trade command.`,
                    event.threadID,
                    event.messageID
                );
            } catch (sendErr) {
                logger.error(`Failed to send error message in execute: ${sendErr.message}`);
            }
        }
    }
};