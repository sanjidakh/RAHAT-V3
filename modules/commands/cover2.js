const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ====== CONFIG ZONE ======
const FB_COVER_API_URL = 'https://nexalo-api.vercel.app/api/facebook-cover-v3';
const ACCESS_TOKEN = '6628568379|c1e620fa708a1d5696fb991c1bde5662'; 
// ==========================

module.exports = {
    name: "cover2",
    version: "1.0.0",
    author: "Hridoy",
    description: "Generate a Facebook cover v3 image with a name, text1, and text2 🎨",
    adminOnly: false,
    commandCategory: "Fun",
    guide: "Use {pn}cover2 name | text1 | text2 to create a cover with your profile picture.\n" +
           "Or use {pn}cover2 @username | name | text1 | text2 to use the mentioned user's profile picture.\n" +
           "Example: {pn}cover2 John | Hello | World\n" +
           "Example: {pn}cover2 @username | John | Hello | World",
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

            const input = args.join(" ").split("|").map(item => item.trim());
            if (input.length < 3 || input.length > 4) {
                return api.sendMessage(
                    `${config.bot.botName}: Please provide input in the format: {pn}cover2 name | text1 | text2 or {pn}cover2 @username | name | text1 | text2`,
                    threadID,
                    messageID
                );
            }

            let imageUserID = event.senderID;
            let name, text1, text2;

            if (input.length === 4 && input[0].startsWith('@')) {
                const mention = event.mentions;
                if (!mention || Object.keys(mention).length === 0) {
                    throw new Error("No user mentioned or mention format is incorrect");
                }
                imageUserID = Object.keys(mention)[0];
                name = input[1];
                text1 = input[2];
                text2 = input[3];
            } else if (input.length === 3) {
                name = input[0];
                text1 = input[1];
                text2 = input[2];
            } else {
                return api.sendMessage(
                    `${config.bot.botName}: Please provide input in the format: {pn}cover2 name | text1 | text2 or {pn}cover2 @username | name | text1 | text2`,
                    threadID,
                    messageID
                );
            }

            if (!name || !text1 || !text2) {
                return api.sendMessage(
                    `${config.bot.botName}: Please provide name, text1, and text2. Example: {pn}cover2 John | Hello | World`,
                    threadID,
                    messageID
                );
            }

            const imageUrl = `https://graph.facebook.com/${imageUserID}/picture?width=512&height=512&access_token=${ACCESS_TOKEN}`;
            const apiUrl = `${FB_COVER_API_URL}?imageUrl=${encodeURIComponent(imageUrl)}&name=${encodeURIComponent(name)}&text1=${encodeURIComponent(text1)}&text2=${encodeURIComponent(text2)}`;

            const coverResponse = await axios.get(apiUrl, { timeout: 30000, responseType: 'stream' });

            const tempDir = path.join(__dirname, '..', '..', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const fileName = `cover2_${crypto.randomBytes(8).toString('hex')}.png`;
            filePath = path.join(tempDir, fileName);

            const writer = fs.createWriteStream(filePath);
            coverResponse.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            const msg = {
                body: `${config.bot.botName}: 🎨 Here's your Facebook cover for "${name}" with text1: "${text1}" and text2: "${text2}"!`,
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