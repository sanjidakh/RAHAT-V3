const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ====== CONFIG ZONE ======
const SKY_API_URL = 'https://nexalo-api.vercel.app/api/sky-blend';
const ACCESS_TOKEN = '6628568379|c1e620fa708a1d5696fb991c1bde5662'; // Access token from the rank command
// ==========================

module.exports = {
    name: "sky",
    version: "1.0.0",
    author: "Hridoy",
    description: "Generate a Sky Blend effect image with your profile picture or a mentioned user's profile picture 🌌",
    adminOnly: false,
    commandCategory: "Fun",
    guide: "Use {pn}sky to generate a Sky Blend effect for yourself.\n" +
           "Or use {pn}sky @username to generate a Sky Blend effect for the mentioned user.\n" +
           "Example: {pn}sky\n" +
           "Example: {pn}sky @username",
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
            const apiUrl = `${SKY_API_URL}?imageUrl=${encodeURIComponent(imageUrl)}&blendMode=overlay&opacity=0.7`;

            const skyResponse = await axios.get(apiUrl, { timeout: 30000, responseType: 'stream' });

            const tempDir = path.join(__dirname, '..', '..', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const fileName = `sky_${crypto.randomBytes(8).toString('hex')}.png`;
            filePath = path.join(tempDir, fileName);

            const writer = fs.createWriteStream(filePath);
            skyResponse.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            const msg = {
                body: `${config.bot.botName}: 🌌 Here's your Sky Blend effect image!`,
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