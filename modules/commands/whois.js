const config = require('../../config/config.json');
const logger = require('../../includes/logger');

module.exports = {
    name: "whois",
    version: "1.0.0",
    author: "Hridoy",
    description: "Retrieve a user's name from their UID using the Facebook Chat API.",
    adminOnly: false,
    commandCategory: "Utility",
    guide: "Use {pn}whois <uid> to get the name of a user by their UID.\n" +
           "Example: {pn}whois 123456789",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        if (!event || !event.threadID || !event.messageID) {
            logger.error("Invalid event object in whois command");
            return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, event.threadID);
        }

        try {
            const uid = args[0]?.trim();

            if (!uid || !/^\d+$/.test(uid)) {
                logger.warn(`Invalid UID provided: ${uid} in thread ${event.threadID}`);
                return api.sendMessage(
                    `${config.bot.botName}: ⚠️ Please provide a valid UID (numeric ID). Example: .whois 123456789`,
                    event.threadID,
                    event.messageID
                );
            }

            logger.info(`Fetching user info for UID: ${uid} in thread ${event.threadID}`);
            const userInfo = await new Promise((resolve, reject) => {
                api.getUserInfo([uid], (err, info) => {
                    if (err) {
                        logger.error(`Failed to fetch user info for UID ${uid}: ${err.message}`);
                        reject(new Error(`API error: ${err.message}`));
                    } else {
                        resolve(info);
                    }
                });
            });

            if (!userInfo[uid] || !userInfo[uid].name) {
                logger.warn(`No user found with UID: ${uid} in thread ${event.threadID}`);
                return api.sendMessage(
                    `${config.bot.botName}: No user found with the provided UID.`,
                    event.threadID,
                    event.messageID
                );
            }

            const userName = userInfo[uid].name;
            logger.info(`Successfully fetched name: ${userName} for UID: ${uid}`);

            await new Promise((resolve, reject) => {
                api.sendMessage(
                    `${config.bot.botName}: User Name: ${userName}`,
                    event.threadID,
                    (err) => {
                        if (err) {
                            logger.error(`Failed to send message: ${err.message}`);
                            reject(err);
                        } else {
                            logger.info("User info sent successfully");
                            resolve();
                        }
                    },
                    event.messageID
                );
            });
        } catch (err) {
            logger.error(`Error in whois command: ${err.message}`);
            await new Promise((resolve, reject) => {
                api.sendMessage(
                    `${config.bot.botName}: Sorry, I couldn't fetch the user info. Please try again later.`,
                    event.threadID,
                    (err) => {
                        if (err) {
                            logger.error(`Failed to send error message: ${err.message}`);
                            reject(err);
                        } else {
                            logger.info("Error message sent successfully");
                            resolve();
                        }
                    },
                    event.messageID
                );
            });
        }
    }
};