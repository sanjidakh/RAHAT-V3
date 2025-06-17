const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const axios = require('axios');

// ====== CONFIG ZONE ======
const GPT4_API_URL = 'https://nexalo-api.vercel.app/api/gpt4-v1';
// ==========================

module.exports = {
    name: "gpt4",
    version: "1.0.0",
    author: "Hridoy",
    description: "Interact with GPT-4 to get responses to your queries 💬",
    adminOnly: false,
    commandCategory: "AI",
    guide: "Use {pn}gpt4 <query> to ask a question to GPT-4.\n" +
           "Example: {pn}gpt4 Hi",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        const threadID = event.threadID;
        const messageID = event.messageID;
        const senderID = event.senderID;

        try {
            if (!event || !threadID || !messageID) {
                logger.error("Invalid event object in gpt4 command", { event });
                return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, threadID);
            }

            if (!args[0]) {
                logger.warn("No query provided in gpt4 command");
                api.setMessageReaction("❌", messageID, () => {}, true);
                return api.sendMessage(
                    `${config.bot.botName}: ❌ Please provide a query. Example: {pn}gpt4 <query>`,
                    threadID,
                    messageID
                );
            }

            const userQuery = args.join(" ").trim();
            logger.info(`Processing GPT-4 query: "${userQuery}" in thread ${threadID}`);

       
            const apiUrl = `${GPT4_API_URL}?ask=${encodeURIComponent(userQuery)}`;
            logger.info(`Calling GPT-4 API: ${apiUrl}`);
            const response = await axios.get(apiUrl, { timeout: 30000 });

            if (!response.data || !response.data.status || !response.data.reply) {
                logger.error(`GPT-4 API response: ${JSON.stringify(response.data)}`);
                throw new Error(response.data?.message || "Failed to get a response from GPT-4");
            }

            const gptReply = response.data.reply;
            logger.info(`GPT-4 response: ${gptReply}`);

           
            const senderInfo = await new Promise((resolve, reject) => {
                api.getUserInfo([senderID], (err, info) => {
                    if (err) reject(err);
                    else resolve(info);
                });
            });
            const senderName = senderInfo[senderID]?.name || "Unknown User";

            
            const msg = `${config.bot.botName}: 💬 ${gptReply}`;

            logger.info(`Sending GPT-4 reply to ${senderName} in thread ${threadID}`);
            await new Promise((resolve, reject) => {
                api.sendMessage(msg, threadID, (err) => {
                    if (err) return reject(err);
                    api.setMessageReaction("💬", messageID, () => {}, true);
                    resolve();
                }, messageID);
            });
            logger.info("GPT-4 reply sent successfully");

            logger.info(`[GPT4 Command] Sent reply "${gptReply}" to ${senderName}`);
        } catch (err) {
            logger.error(`Error in gpt4 command: ${err.message}`, { stack: err.stack });

            api.setMessageReaction("❌", messageID, () => {}, true);
            await api.sendMessage(
                `${config.bot.botName}: ⚠️ Error: ${err.message}`,
                threadID,
                messageID
            );
        }
    }
};