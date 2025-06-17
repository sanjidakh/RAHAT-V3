const config = require('../../config/config.json');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const COMIC_API_URL = 'https://nexalo-api.vercel.app/api/comic-effect';
const ACCESS_TOKEN = '6628568379|c1e620fa708a1d5696fb991c1bde5662';

module.exports = {
    name: "comic",
    version: "1.1.0",
    author: "Hridoy",
    description: "Generate a comic effect image using the command user's or a mentioned user's profile picture with custom text 🎭",
    adminOnly: false,
    commandCategory: "Fun",
    guide: "Use {pn}comic <text> to create a comic effect image with your profile picture.\n" +
           "Or use {pn}comic @username <text> to create a comic effect image with the mentioned user's profile picture.\n" +
           "Example: {pn}comic Awesome!\n" +
           "Example: {pn}comic @username Wow!",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        const threadID = event.threadID;
        const messageID = event.messageID;
        const senderID = event.senderID;

        try {
            if (!event || !threadID || !messageID) {
                return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, threadID);
            }

            if (args.length < 1) {
                return api.sendMessage(
                    `${config.bot.botName}: ❌ Please provide text to use in the comic. Example: {pn}comic Awesome!`,
                    threadID,
                    messageID
                );
            }

            let imageUrl;
            let text;

            if (event.mentions && Object.keys(event.mentions).length > 0) {
                const mentionedUserID = Object.keys(event.mentions)[0];
                imageUrl = `https://graph.facebook.com/${mentionedUserID}/picture?width=512&height=512&access_token=${ACCESS_TOKEN}`;
                text = args.slice(1).join(" ").trim();
            } else {
                imageUrl = `https://graph.facebook.com/${senderID}/picture?width=512&height=512&access_token=${ACCESS_TOKEN}`;
                text = args.join(" ").trim();
            }

            if (!text) {
                return api.sendMessage(
                    `${config.bot.botName}: ❌ Please provide text to use in the comic. Example: {pn}comic Awesome!`,
                    threadID,
                    messageID
                );
            }

            const apiUrl = `${COMIC_API_URL}?image=${encodeURIComponent(imageUrl)}&text=${encodeURIComponent(text)}`;

           
            const response = await axios.get(apiUrl, { responseType: 'stream', timeout: 30000 });

            const tempDir = path.join(__dirname, '..', '..', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const fileName = `comic_${crypto.randomBytes(8).toString('hex')}.png`;
            const filePath = path.join(tempDir, fileName);

            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            const msg = {
                body: `${config.bot.botName}: 🎭 Here's your comic effect image!`,
                attachment: fs.createReadStream(filePath)
            };

            await api.sendMessage(msg, threadID);

            fs.unlinkSync(filePath);
        } catch (err) {
            await api.sendMessage(`${config.bot.botName}: ⚠️ Error: ${err.message}`, threadID, messageID);
        }
    }
};