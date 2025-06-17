const config = require('../../config/config.json');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ====== CONFIG ZONE ======
const GAY_API_URL = 'https://nexalo-api.vercel.app/api/gay';
const ACCESS_TOKEN = '6628568379|c1e620fa708a1d5696fb991c1bde5662';

module.exports = {
    name: "gay",
    version: "1.0.0",
    author: "Hridoy",
    description: "Generate a 'gay' effect image using the command user's or a mentioned user's profile picture 🏳️‍🌈",
    adminOnly: false,
    commandCategory: "Fun",
    guide: "Use {pn}gay to create a 'gay' effect image with your profile picture.\n" +
           "Or use {pn}gay @username to create a 'gay' effect image with the mentioned user's profile picture.\n" +
           "Example: {pn}gay\n" +
           "Example: {pn}gay @username",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event }) {
        const threadID = event.threadID;
        const messageID = event.messageID;
        const senderID = event.senderID;

        try {
            if (!event || !threadID || !messageID) {
                return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, threadID);
            }

            let imageUrl;

            if (event.mentions && Object.keys(event.mentions).length > 0) {
                const mentionedUserID = Object.keys(event.mentions)[0];
                imageUrl = `https://graph.facebook.com/${mentionedUserID}/picture?width=512&height=512&access_token=${ACCESS_TOKEN}`;
            } else {
                imageUrl = `https://graph.facebook.com/${senderID}/picture?width=512&height=512&access_token=${ACCESS_TOKEN}`;
            }

            const apiUrl = `${GAY_API_URL}?imageurl=${encodeURIComponent(imageUrl)}`;

            const gayResponse = await axios.get(apiUrl, { timeout: 30000 });

            if (!gayResponse.data || !gayResponse.data.status || !gayResponse.data.url) {
                throw new Error(gayResponse.data.message || "Failed to generate 'gay' effect image");
            }

            const gayImageUrl = gayResponse.data.url;

            const imageResponse = await axios.get(gayImageUrl, { responseType: 'stream', timeout: 15000 });

            const tempDir = path.join(__dirname, '..', '..', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const fileName = `gay_${crypto.randomBytes(8).toString('hex')}.png`;
            const filePath = path.join(tempDir, fileName);

            const writer = fs.createWriteStream(filePath);
            imageResponse.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            const msg = {
                body: `${config.bot.botName}: 🏳️‍🌈 Here's your 'gay' effect image!`,
                attachment: fs.createReadStream(filePath)
            };

            await api.sendMessage(msg, threadID);

            fs.unlinkSync(filePath);
        } catch (err) {
            await api.sendMessage(`${config.bot.botName}: ⚠️ Error: ${err.message}`, threadID, messageID);
        }
    }
};