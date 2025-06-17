const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ====== CONFIG ZONE ======
const CLOWN_API_URL = 'https://api.popcat.xyz/clown';
const ACCESS_TOKEN = '6628568379|c1e620fa708a1d5696fb991c1bde5662'; // Access token from the rank command
// ==========================

module.exports = {
    name: "clown",
    version: "1.0.0",
    author: "Hridoy",
    description: "Generate a clown image using the command user's profile picture or a mentioned user's profile picture 🤡",
    adminOnly: false,
    commandCategory: "Fun",
    guide: "Use {pn}clown to generate a clown image for yourself.\n" +
           "Or use {pn}clown @username to generate a clown image for the mentioned user.\n" +
           "Example: {pn}clown\n" +
           "Example: {pn}clown @username",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        const threadID = event.threadID;
        const messageID = event.messageID;

        let filePath;

        try {
            if (!event || !threadID || !messageID) {
                return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, threadID);
            }

            let imageUserID = event.senderID;

            if (args.length > 0 && args[0].startsWith('@')) {
                const mention = event.mentions;
                if (!mention || Object.keys(mention).length === 0) {
                    throw new Error("No user mentioned or mention format is incorrect");
                }
                imageUserID = Object.keys(mention)[0];
            }

            const imageUrl = `https://graph.facebook.com/${imageUserID}/picture?width=512&height=512&access_token=${ACCESS_TOKEN}`;
            const apiUrl = `${CLOWN_API_URL}?image=${encodeURIComponent(imageUrl)}`;

            const clownResponse = await axios.get(apiUrl, { timeout: 30000, responseType: 'stream' });

            const tempDir = path.join(__dirname, '..', '..', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const fileName = `clown_${crypto.randomBytes(8).toString('hex')}.png`;
            filePath = path.join(tempDir, fileName);

            const writer = fs.createWriteStream(filePath);
            clownResponse.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            const msg = {
                body: `${config.bot.botName}: 🤡 Here's your clown image!`,
                attachment: fs.createReadStream(filePath)
            };

            await api.sendMessage(msg, threadID);

            fs.unlinkSync(filePath);
        } catch (err) {
            await api.sendMessage(
                `${config.bot.botName}: ⚠️ Error: ${err.message}`,
                threadID,
                messageID
            );

            if (filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
    }
};