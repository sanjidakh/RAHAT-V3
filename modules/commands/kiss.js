const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ====== CONFIG ZONE ======
const KISS_API_URL = 'https://nexalo-api.vercel.app/api/kiss';
const ACCESS_TOKEN = '6628568379|c1e620fa708a1d5696fb991c1bde5662';

module.exports = {
    name: "kiss",
    version: "1.1.0",
    author: "Hridoy",
    description: "Generate a kiss image with mentioned users' profile pictures 💋",
    adminOnly: false,
    commandCategory: "Fun",
    guide: "Use {pn}kiss @username to generate a kiss image with yourself and the mentioned user.\n" +
           "Or use {pn}kiss @username1 @username2 to generate a kiss image between the two mentioned users.\n" +
           "Example: {pn}kiss @username\n" +
           "Example: {pn}kiss @username1 @username2",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event }) {
        const threadID = event.threadID;
        const messageID = event.messageID;

        try {
            if (!event || !threadID || !messageID) {
                return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, threadID);
            }

            const mentions = Object.keys(event.mentions);

            if (mentions.length === 0) {
                return api.sendMessage(
                    `${config.bot.botName}: ❌ Please mention at least one user. Example: {pn}kiss @username or {pn}kiss @username1 @username2`,
                    threadID,
                    messageID
                );
            }

            let image1, image2;

            if (mentions.length === 1) {
                const mentionedUserID = mentions[0];
                image1 = `https://graph.facebook.com/${mentionedUserID}/picture?width=512&height=512&access_token=${ACCESS_TOKEN}`;
                image2 = `https://graph.facebook.com/${event.senderID}/picture?width=512&height=512&access_token=${ACCESS_TOKEN}`;
            } else if (mentions.length >= 2) {
                const mentionedUserID1 = mentions[0];
                const mentionedUserID2 = mentions[1];
                image1 = `https://graph.facebook.com/${mentionedUserID2}/picture?width=512&height=512&access_token=${ACCESS_TOKEN}`;
                image2 = `https://graph.facebook.com/${mentionedUserID1}/picture?width=512&height=512&access_token=${ACCESS_TOKEN}`;
            }

            const apiUrl = `${KISS_API_URL}?image1=${encodeURIComponent(image1)}&image2=${encodeURIComponent(image2)}`;

            const kissResponse = await axios.get(apiUrl, { timeout: 30000 });

            if (!kissResponse.data || !kissResponse.data.status || !kissResponse.data.url) {
                throw new Error(kissResponse.data.message || "Failed to generate kiss image");
            }

            const kissImageUrl = kissResponse.data.url;

            const imageResponse = await axios.get(kissImageUrl, { responseType: 'stream', timeout: 15000 });

            const tempDir = path.join(__dirname, '..', '..', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const fileName = `kiss_${crypto.randomBytes(8).toString('hex')}.png`;
            const filePath = path.join(tempDir, fileName);

            const writer = fs.createWriteStream(filePath);
            imageResponse.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            const msg = {
                body: `${config.bot.botName}: 💋 Here's your kiss image!`,
                attachment: fs.createReadStream(filePath)
            };

            await api.sendMessage(msg, threadID);

            fs.unlinkSync(filePath);
        } catch (err) {
            await api.sendMessage(`${config.bot.botName}: ⚠️ Error: ${err.message}`, threadID, messageID);
        }
    }
};