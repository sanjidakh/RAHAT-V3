const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const axios = require('axios');

// ====== CONFIG ZONE ======
const GEMINI_API_URL = 'https://nexalo-api.vercel.app/api/gemini-1.5-pro';
// ==========================

module.exports = {
    name: "gemini",
    version: "1.0.0",
    author: "Hridoy",
    description: "Interact with Gemini 1.5 Pro to get responses to your queries 💬",
    adminOnly: false,
    commandCategory: "AI",
    guide: "Use {pn}gemini <query> to ask a question to Gemini 1.5 Pro.\n" +
           "Example: {pn}gemini Hello",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        const threadID = event.threadID;
        const messageID = event.messageID;
        const senderID = event.senderID;

        try {
            if (!event || !threadID || !messageID) {
                logger.error("Invalid event object in gemini command", { event });
                return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, threadID);
            }

            if (!args[0]) {
                logger.warn("No query provided in gemini command");
                api.setMessageReaction("❌", messageID, () => {}, true);
                return api.sendMessage(
                    `${config.bot.botName}: ❌ Please provide a query. Example: {pn}gemini <query>`,
                    threadID,
                    messageID
                );
            }

            const userQuery = args.join(" ").trim();
            logger.info(`Processing Gemini query: "${userQuery}" in thread ${threadID}`);

            const apiUrl = `${GEMINI_API_URL}?ask=${encodeURIComponent(userQuery)}`;
            logger.info(`Calling Gemini API: ${apiUrl}`);
            const response = await axios.get(apiUrl, { timeout: 30000 });

            if (!response.data || !response.data.status || !response.data.reply) {
                logger.error(`Gemini API response: ${JSON.stringify(response.data)}`);
                throw new Error(response.data?.message || "Failed to get a response from Gemini 1.5 Pro");
            }

            const geminiReply = response.data.reply;
            logger.info(`Gemini response: ${geminiReply}`);

            const senderInfo = await new Promise((resolve, reject) => {
                api.getUserInfo([senderID], (err, info) => {
                    if (err) reject(err);
                    else resolve(info);
                });
            });
            const senderName = senderInfo[senderID]?.name || "Unknown User";

            const msg = `${config.bot.botName}: 💬 ${geminiReply}`;

            logger.info(`Sending Gemini reply to ${senderName} in thread ${threadID}`);
            await new Promise((resolve, reject) => {
                api.sendMessage(msg, threadID, (err) => {
                    if (err) return reject(err);
                    api.setMessageReaction("💬", messageID, () => {}, true);
                    resolve();
                }, messageID);
            });
            logger.info("Gemini reply sent successfully");

            logger.info(`[Gemini Command] Sent reply "${geminiReply}" to ${senderName}`);
        } catch (err) {
            logger.error(`Error in gemini command: ${err.message}`, { stack: err.stack });

            api.setMessageReaction("❌", messageID, () => {}, true);
            await api.sendMessage(
                `${config.bot.botName}: ⚠️ Error: ${err.message}`,
                threadID,
                messageID
            );
        }
    }
};