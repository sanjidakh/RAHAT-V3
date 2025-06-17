/******************************************************************************
 * WARNING: Use this command carefully. Make sure to validate the question-   *
 * answer pairs before teaching the bot. Improper training data might lead   *
 * to inaccurate responses.                                                  *
 * Also, ensure you are using your own API key for training purposes.        *
 ******************************************************************************/

const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const axios = require('axios');

// ====== CONFIG ZONE ======
const TRAIN_API_URL = 'https://sim.api.nexalo.xyz/v1/train';
const API_KEY = 'YOUR_API_KEY'; // Replace with your actual API key
const LANGUAGE = 'bn';
// ==========================

module.exports = {
    name: "teach",
    version: "1.0.0",
    author: "Hridoy",
    description: "Teaches the bot a new question-answer pair via Nexalo SIM API.",
    adminOnly: false,
    commandCategory: "Training",
    guide: "Use {pn}teach <question> | <answer> to teach the bot.\n" +
           "Example: {pn}teach What is AI? | Artificial Intelligence",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        const threadID = event.threadID;
        const messageID = event.messageID;

        try {
            // Validate event object
            if (!event || !threadID || !messageID) {
                logger.error("Invalid event object in teach command", { event });
                return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, threadID);
            }

            const input = args.join(" ").trim();
            logger.info(`Received command: .teach ${input} in thread ${threadID}`);

            // Validate input format
            if (!input.includes("|")) {
                logger.warn("Input missing '|' separator");
                return api.sendMessage(
                    `${config.bot.botName}: Please provide both a question and an answer separated by '|'. Example: {pn}teach What is AI? | Artificial Intelligence`,
                    threadID
                );
            }

            const [question, answer] = input.split("|").map(item => item.trim());

            if (!question || !answer) {
                logger.warn("Question or answer is empty");
                return api.sendMessage(
                    `${config.bot.botName}: Both question and answer must be non-empty. Example: {pn}teach What is AI? | Artificial Intelligence`,
                    threadID
                );
            }

            // Prepare API payload
            const payload = {
                api: API_KEY,
                question: question,
                answer: answer,
                language: LANGUAGE
            };

            logger.info(`Sending request to Nexalo SIM API (train): ${JSON.stringify(payload)}`);

            // Send request to Nexalo SIM API
            const response = await axios.post(TRAIN_API_URL, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000 // 30-second timeout
            });

            const result = response.data;
            logger.info(`API response received: ${JSON.stringify(result)}`);

            // Handle API response
            if (result.status_code === 201 && result.status === 'Created' && result.data) {
                logger.info(`Successfully trained: "${question}" -> "${answer}"`);
                api.sendMessage(
                    `${config.bot.botName}: Learned: "${question}" -> "${answer}"\nTraining ID: ${result.data.id}`,
                    threadID
                );
            } else {
                const errorMessage = result.message || 'Unknown error from API';
                logger.warn(`API returned an error: ${errorMessage}`);
                api.sendMessage(
                    `${config.bot.botName}: API Error: ${errorMessage}`,
                    threadID
                );
            }
        } catch (err) {
            const errorDetails = {
                message: err.message,
                response: err.response ? JSON.stringify(err.response.data) : 'No response',
                status: err.response ? err.response.status : 'N/A'
            };
            logger.error(`Request failed: ${JSON.stringify(errorDetails)}`);
            api.sendMessage(
                `${config.bot.botName}: Sorry, I couldn't reach the API. Please try again later.`,
                threadID
            );
        }
    }
};