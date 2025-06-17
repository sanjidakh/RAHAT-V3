const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ====== CONFIG ZONE ======
const FAKE_CHAT_API_URL = 'https://nexalo-api.vercel.app/api/fake-chat-v2';
const ACCESS_TOKEN = '6628568379|c1e620fa708a1d5696fb991c1bde5662'; 
// ==========================

module.exports = {
    name: "fakechat2",
    version: "1.0.0",
    author: "Hridoy",
    description: "Generate a fake chat bubble with a user's profile picture and custom text (v2) 💬",
    adminOnly: false,
    commandCategory: "Fun",
    guide: "Use {pn}fakechat2 text to create a fake chat bubble for yourself.\n" +
           "Or use {pn}fakechat2 @username text to create a fake chat bubble for the mentioned user.\n" +
           "Example: {pn}fakechat2 Hello World\n" +
           "Example: {pn}fakechat2 @username Hello World",
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

            if (args.length < 1) {
                return api.sendMessage(
                    `${config.bot.botName}: Please provide some text for the fake chat. Example: {pn}fakechat2 Hello World or {pn}fakechat2 @username Hello World`,
                    threadID,
                    messageID
                );
            }

            let imageUserID = event.senderID;
            let text;

            if (args[0].startsWith('@')) {
                const mention = event.mentions;
                if (!mention || Object.keys(mention).length === 0) {
                    throw new Error("No user mentioned or mention format is incorrect");
                }
                imageUserID = Object.keys(mention)[0];
                text = args.slice(1).join(" ").trim();
            } else {
                text = args.join(" ").trim();
            }

            if (!text) {
                return api.sendMessage(
                    `${config.bot.botName}: Please provide some text for the fake chat. Example: {pn}fakechat2 Hello World or {pn}fakechat2 @username Hello World`,
                    threadID,
                    messageID
                );
            }

            const imageUrl = `https://graph.facebook.com/${imageUserID}/picture?width=512&height=512&access_token=${ACCESS_TOKEN}`;
            const apiUrl = `${FAKE_CHAT_API_URL}?imageUrl=${encodeURIComponent(imageUrl)}&text=${encodeURIComponent(text)}`;

            const fakeChatResponse = await axios.get(apiUrl, { timeout: 30000, responseType: 'stream' });

            const tempDir = path.join(__dirname, '..', '..', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const fileName = `fakechat2_${crypto.randomBytes(8).toString('hex')}.png`;
            filePath = path.join(tempDir, fileName);

            const writer = fs.createWriteStream(filePath);
            fakeChatResponse.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            const msg = {
                body: `${config.bot.botName}: 💬 Here's your fake chat bubble (v2)!`,
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