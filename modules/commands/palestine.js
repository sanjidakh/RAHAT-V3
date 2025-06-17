const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ====== CONFIG ZONE ======
const ACCESS_TOKEN = '6628568379|c1e620fa708a1d5696fb991c1bde5662';
const PALESTINE_QUOTES = [
    "Freedom for Palestine is justice for all! 🇵🇸",
    "Palestine lives in our hearts forever! ✊",
    "Stand with Palestine, stand with humanity! 🌍",
    "Peace begins with justice for Palestine! 🕊️",
    "Palestine will be free one day! 💪"
];
// ==========================

module.exports = {
    name: "palestine",
    version: "1.0.0",
    author: "Hridoy",
    description: "Apply a Palestine-themed frame to a profile picture 🇵🇸",
    adminOnly: false,
    commandCategory: "Fun",
    guide: "Use {pn}palestine <style 1, 2, or 3> or {pn}palestine @someone <style 1, 2, or 3>\n" +
           "Example: {pn}palestine 1 or {pn}palestine @username 2",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        const threadID = event.threadID;
        const messageID = event.messageID;
        const senderID = event.senderID;

        let filePath;

        try {
            if (!event || !threadID || !messageID) {
                logger.error("Invalid event object in palestine command", { event });
                return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, threadID);
            }

   
            let targetUserID = senderID;
            let targetUserName = "you";
            let style;

            if (event.mentions && Object.keys(event.mentions).length > 0) {
                targetUserID = Object.keys(event.mentions)[0];
                targetUserName = event.mentions[targetUserID].replace(/@/g, '');
                style = args[1];
            } else {
                style = args[0];
            }

            if (!style || !['1', '2', '3'].includes(style)) {
                logger.warn("Invalid style provided in palestine command");
                api.setMessageReaction("❌", messageID, () => {}, true);
                return api.sendMessage(
                    `${config.bot.botName}: ❌ Please provide a valid style (1, 2, or 3). Example: {pn}palestine 1`,
                    threadID,
                    messageID
                );
            }

            logger.info(`Generating Palestine frame for user ${targetUserID} with style ${style} in thread ${threadID}`);

           
            const imageUrl = `https://graph.facebook.com/${targetUserID}/picture?width=512&height=512&access_token=${ACCESS_TOKEN}`;

          
            logger.info(`Validating profile picture URL: ${imageUrl}`);
            const imageCheck = await axios.head(imageUrl, { timeout: 10000 });
            if (imageCheck.status !== 200 || !imageCheck.headers['content-type']?.startsWith('image/')) {
                throw new Error("Failed to fetch a valid profile picture");
            }

           
            let apiUrl;
            if (style === '1') {
                apiUrl = `https://nexalo-api.vercel.app/api/palestine-frame-v2?image=${encodeURIComponent(imageUrl)}`;
            } else if (style === '2') {
                apiUrl = `https://nexalo-api.vercel.app/api/palestine-frame?image=${encodeURIComponent(imageUrl)}&text=__%23Free_Palestine__`;
            } else {
                apiUrl = `https://nexalo-api.vercel.app/api/palestine-v3?image=${encodeURIComponent(imageUrl)}`;
            }

          
            logger.info(`Calling Palestine API: ${apiUrl}`);
            const imageResponse = await axios.get(apiUrl, {
                responseType: 'stream',
                timeout: 15000
            });

           
            const contentType = imageResponse.headers['content-type'];
            if (!contentType || !contentType.startsWith('image/')) {
                throw new Error("API response is not an image");
            }

           
            const tempDir = path.join(__dirname, '..', '..', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const fileName = `palestine_${crypto.randomBytes(8).toString('hex')}.png`;
            filePath = path.join(tempDir, fileName);

       
            const writer = fs.createWriteStream(filePath);
            imageResponse.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

        
            const stats = fs.statSync(filePath);
            if (stats.size === 0) throw new Error("Downloaded image is empty");

 
            const senderInfo = await new Promise((resolve, reject) => {
                api.getUserInfo([senderID], (err, info) => {
                    if (err) reject(err);
                    else resolve(info);
                });
            });
            const senderName = senderInfo[senderID]?.name || "Unknown User";

       
            const randomQuote = PALESTINE_QUOTES[Math.floor(Math.random() * PALESTINE_QUOTES.length)];

          
            const msg = {
                body: `${config.bot.botName}: 🇵🇸 Palestine frame for ${targetUserName}!\n${randomQuote}`,
                attachment: fs.createReadStream(filePath)
            };

            logger.info(`Sending Palestine frame to ${targetUserName} in thread ${threadID}`);
            await new Promise((resolve, reject) => {
                api.sendMessage(msg, threadID, (err) => {
                    if (err) return reject(err);
                    api.setMessageReaction("🇵🇸", messageID, () => {}, true);
                    resolve();
                }, messageID);
            });
            logger.info("Palestine frame sent successfully");

        
            fs.unlinkSync(filePath);
            logger.info(`[Palestine Command] Sent frame to ${targetUserName} for ${senderName}`);
        } catch (err) {
            logger.error(`Error in palestine command: ${err.message}`, { stack: err.stack });

            api.setMessageReaction("❌", messageID, () => {}, true);
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