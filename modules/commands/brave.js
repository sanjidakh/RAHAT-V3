const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const axios = require('axios');

// ====== CONFIG ZONE ======
const BRAVE_API_URL = 'https://nexalo-api.vercel.app/api/brave';
// ==========================

module.exports = {
    name: "brave",
    version: "1.0.0",
    author: "Hridoy",
    description: "Interact with Brave API to get responses to your queries 💬",
    adminOnly: false,
    commandCategory: "AI",
    guide: "Use {pn}brave <query> to ask a question to Brave API.\n" +
           "Example: {pn}brave Hello",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        const threadID = event.threadID;
        const messageID = event.messageID;
        const senderID = event.senderID;

        try {
            if (!event || !threadID || !messageID) {
                logger.error("Invalid event object in brave command", { event });
                return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, threadID);
            }

            if (!args[0]) {
                logger.warn("No query provided in brave command");
                api.setMessageReaction("❌", messageID, () => {}, true);
                return api.sendMessage(
                    `${config.bot.botName}: ❌ Please provide a query. Example: {pn}brave <query>`,
                    threadID,
                    messageID
                );
            }

            const userQuery = args.join(" ").trim();
            logger.info(`Processing Brave query: "${userQuery}" in thread ${threadID}`);

            const apiUrl = `${BRAVE_API_URL}?search=${encodeURIComponent(userQuery)}`;
            logger.info(`Calling Brave API: ${apiUrl}`);
            const response = await axios.get(apiUrl, { timeout: 30000 });

            if (!response.data || !response.data.status || !response.data.details) {
                logger.error(`Brave API response: ${JSON.stringify(response.data)}`);
                throw new Error(response.data?.message || "Failed to get a response from Brave API");
            }

            const braveDetails = response.data.details;
            logger.info(`Brave response: ${braveDetails}`);

            const senderInfo = await new Promise((resolve, reject) => {
                api.getUserInfo([senderID], (err, info) => {
                    if (err) reject(err);
                    else resolve(info);
                });
            });
            const senderName = senderInfo[senderID]?.name || "Unknown User";

            const msg = `${config.bot.botName}: 💬 ${braveDetails}`;

            logger.info(`Sending Brave reply to ${senderName} in thread ${threadID}`);
            await new Promise((resolve, reject) => {
                api.sendMessage(msg, threadID, (err) => {
                    if (err) return reject(err);
                    api.setMessageReaction("💬", messageID, () => {}, true);
                    resolve();
                }, messageID);
            });
            logger.info("Brave reply sent successfully");

            logger.info(`[Brave Command] Sent reply "${braveDetails}" to ${senderName}`);
        } catch (err) {
            logger.error(`Error in brave command: ${err.message}`, { stack: err.stack });

            api.setMessageReaction("❌", messageID, () => {}, true);
            await api.sendMessage(
                `${config.bot.botName}: ⚠️ Error: ${err.message}`,
                threadID,
                messageID
            );
        }
    }
};