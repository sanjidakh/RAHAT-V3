const config = require('../../config/config.json');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ====== CONFIG ZONE ======
const PUZZLE_API_URL = 'https://nexalo-api.vercel.app/api/puzzle';
const ACCESS_TOKEN = '6628568379|c1e620fa708a1d5696fb991c1bde5662';

module.exports = {
    name: "puzzle",
    version: "1.0.0",
    author: "Hridoy",
    description: "Generate a puzzle effect image using the command user's or a mentioned user's profile picture with a specified number of pieces 🧩",
    adminOnly: false,
    commandCategory: "Fun",
    guide: "Use {pn}puzzle <pieces> to create a puzzle effect image with your profile picture.\n" +
           "Or use {pn}puzzle @username <pieces> to create a puzzle effect image with the mentioned user's profile picture.\n" +
           "Example: {pn}puzzle 9\n" +
           "Example: {pn}puzzle @username 16",
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
                    `${config.bot.botName}: ❌ Please provide the number of pieces for the puzzle. Example: {pn}puzzle 9`,
                    threadID,
                    messageID
                );
            }

            let imageUrl;
            let pieces;

            if (event.mentions && Object.keys(event.mentions).length > 0) {
                const mentionedUserID = Object.keys(event.mentions)[0];
                imageUrl = `https://graph.facebook.com/${mentionedUserID}/picture?width=512&height=512&access_token=${ACCESS_TOKEN}`;
                pieces = args.slice(1).join(" ").trim();
            } else {
                imageUrl = `https://graph.facebook.com/${senderID}/picture?width=512&height=512&access_token=${ACCESS_TOKEN}`;
                pieces = args.join(" ").trim();
            }

            if (!pieces || isNaN(pieces) || pieces <= 0) {
                return api.sendMessage(
                    `${config.bot.botName}: ❌ Please provide a valid number of pieces for the puzzle. Example: {pn}puzzle 9`,
                    threadID,
                    messageID
                );
            }

            const apiUrl = `${PUZZLE_API_URL}?image=${encodeURIComponent(imageUrl)}&pieces=${encodeURIComponent(pieces)}`;

            const response = await axios.get(apiUrl, { responseType: 'stream', timeout: 30000 });

            const tempDir = path.join(__dirname, '..', '..', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const fileName = `puzzle_${crypto.randomBytes(8).toString('hex')}.png`;
            const filePath = path.join(tempDir, fileName);

            const writer = fs.createWriteStream(filePath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            const msg = {
                body: `${config.bot.botName}: 🧩 Here's your puzzle effect image!`,
                attachment: fs.createReadStream(filePath)
            };

            await api.sendMessage(msg, threadID);

            fs.unlinkSync(filePath);
        } catch (err) {
            await api.sendMessage(`${config.bot.botName}: ⚠️ Error: ${err.message}`, threadID, messageID);
        }
    }
};