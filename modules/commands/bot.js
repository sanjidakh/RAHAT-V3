const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const axios = require('axios');

// ====== CONFIG ZONE ======
const SIM_API_URL = 'https://sim.api.nexalo.xyz/v1/chat';
const API_KEY = 'MAINPOINT';
const LANGUAGE = 'bn';
const DEFAULT_QUESTIONS = [
    "bot"
];

function getRandomDefaultQuestion() {
    return DEFAULT_QUESTIONS[Math.floor(Math.random() * DEFAULT_QUESTIONS.length)];
}
// ==========================

module.exports = {
    name: "cat",
    version: "1.0.5",
    author: "Hridoy",
    description: "Chat with the Nexalo SIM API by sending a question or command.",
    adminOnly: false,
    commandCategory: "AI",
    guide: "Use {pn}cat <question> to ask a question.\n" +
           "Example: {pn}cat What is the weather like?",
    cooldowns: 1,
    usePrefix: false,

    async execute({ api, event, args }) {
        if (!event || !event.threadID || !event.messageID) {
            logger.error("Invalid event object in cat command");
            return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, event.threadID);
        }

        try {
            const question = args.join(" ").trim() || getRandomDefaultQuestion();

            logger.info(`Received command: .cat ${question} in thread ${event.threadID}`);

            // Prepare API payload
            const payload = {
                api: API_KEY,
                question: question,
                language: LANGUAGE
            };

            logger.info(`Sending request to Nexalo SIM API: ${JSON.stringify(payload)}`);

            // Send request to Nexalo SIM API
            const res = await axios.post(SIM_API_URL, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000 
            });

            logger.info(`API response received: ${JSON.stringify(res.data)}`);

          
            if (res.data.status_code === 200 && res.data.status === 'OK' && res.data.data && res.data.data.answer) {
                const answer = res.data.data.answer;
                logger.info(`Sending answer: ${answer}`);
                await new Promise((resolve, reject) => {
                    api.sendMessage(
                        answer,
                        event.threadID,
                        (err) => {
                            if (err) {
                                logger.error(`Failed to send answer: ${err.message}`);
                                reject(err);
                            } else {
                                logger.info("Answer sent successfully");
                                resolve();
                            }
                        },
                        event.messageID
                    );
                });
            } else {
                const errorMessage = res.data.message || 'No answer returned.';
                logger.warn(`API returned an error: ${errorMessage}`);
                await new Promise((resolve, reject) => {
                    api.sendMessage(
                        `${config.bot.botName}: API Error: ${errorMessage}`,
                        event.threadID,
                        (err) => {
                            if (err) {
                                logger.error(`Failed to send API error message: ${err.message}`);
                                reject(err);
                            } else {
                                logger.info("API error message sent successfully");
                                resolve();
                            }
                        },
                        event.messageID 
                    );
                });
            }
        } catch (err) {
            const errorDetails = {
                message: err.message,
                response: err.response ? JSON.stringify(err.response.data) : 'No response',
                status: err.response ? err.response.status : 'N/A'
            };
            logger.error(`Request failed: ${JSON.stringify(errorDetails)}`);
            await new Promise((resolve, reject) => {
                api.sendMessage(
                    `${config.bot.botName}: Sorry, I couldn't reach the API. Please try again later.`,
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