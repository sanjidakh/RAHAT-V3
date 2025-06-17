const config = require('../../config/config.json');
const axios = require('axios');

module.exports = {
    name: "ngl",
    version: "1.0.0",
    author: "Hridoy",
    description: "Send spam messages to an NGL username.",
    adminOnly: false,
    commandCategory: "Tools",
    guide: "{pn}ngl name|amount|message - Send spam messages (e.g., .ngl hridoyshubho|10|Hello).",
    cooldowns: 30,
    usePrefix: true,

    async execute({ api, event }) {
        const threadID = event.threadID;
        const messageID = event.messageID;
        const args = event.body.split(' ').slice(1);
        const prefix = config.prefix || ".";

        if (!args[0] || !args[0].includes('|')) {
            return api.sendMessage(`${config.bot.botName}: ❌ Invalid format. Use ${prefix}ngl name|amount|message (e.g., ${prefix}ngl hridoyshubho|10|Hello).`, threadID, messageID);
        }

        const [username, amountStr, message] = args[0].split('|').map(item => item.trim());
        const amount = parseInt(amountStr);

        if (!username || !amountStr || !message || isNaN(amount) || amount <= 0) {
            return api.sendMessage(`${config.bot.botName}: ❌ Invalid input. Ensure name, amount (positive number), and message are provided.`, threadID, messageID);
        }

        console.log(`Sending NGL spam - Username: ${username}, Amount: ${amount}, Message: ${message}`);

        try {
            const apiUrl = `https://nexalo-api.vercel.app/api/nglspam?username=${encodeURIComponent(username)}&amount=${amount}&message=${encodeURIComponent(message)}`;
            console.log(`Sending request to ${apiUrl}`);

            const response = await axios.get(apiUrl, { timeout: 10000 });
            const data = response.data;
            console.log(`API response received: ${JSON.stringify(data)}`);

            if (!data.response) {
                return api.sendMessage(`${config.bot.botName}: ❌ Failed to send messages.`, threadID, messageID);
            }

            await api.sendMessage(`${config.bot.botName}: 📨 ${data.response}`, threadID, messageID);
            console.log(`Sent response to thread ${threadID}`);
        } catch (error) {
            console.log(`Error in ngl command: ${error.message}`);
            api.sendMessage(`${config.bot.botName}: ❌ Failed to send messages: ${error.message}`, threadID, messageID);
        }
    }
};