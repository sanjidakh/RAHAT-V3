const config = require('../../config/config.json');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../../includes/logger');

// ====== CONFIG ZONE ======
const BDAY_API_URL = 'https://nexalo-api.vercel.app/api/birthday';
const ACCESS_TOKEN = '6628568379|c1e620fa708a1d5696fb991c1bde5662';
const BIRTHDAY_WISHES = [
    "🎉 Happy Birthday, {name}! May all your dreams come true! 🥳",
    "🎂 Wishing you an amazing birthday filled with laughter and joy, {name}! 🎁",
    "🎈 Happy Birthday, {name}! Have a fantastic year ahead! 🎊",
    "🌟 Cheers to another year of awesomeness, {name}! Happy Birthday! 🧁",
    "🎁 May your day be as special as you are, {name}! Happy Birthday! 🎉"
];
// ==========================

module.exports = {
    name: "bday",
    version: "1.1.1",
    author: "Hridoy",
    description: "Generate a birthday image for someone with their name 🎂",
    adminOnly: false,
    commandCategory: "Fun",
    guide: "Use {pn}bday @username | Name to generate a birthday image for the mentioned user with the given name.\n" +
           "Example: {pn}bday @username | John",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        const threadID = event.threadID;
        const messageID = event.messageID;
        const senderID = event.senderID;

        let filePath;

        try {
            if (!event || !threadID || !messageID) {
                logger.error("Invalid event object in bday command", { event });
                return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, threadID);
            }

            if (!event.mentions || Object.keys(event.mentions).length === 0) {
                logger.warn("No user mentioned in bday command");
                api.setMessageReaction("❌", messageID, () => {}, true);
                return api.sendMessage(
                    `${config.bot.botName}: ❌ Please mention a user and provide a name. Example: {pn}bday @username | Name`,
                    threadID,
                    messageID
                );
            }

            const mentionedUserID = Object.keys(event.mentions)[0];
            const input = args.join(" ").split("|").map(item => item.trim());

            if (input.length < 2 || !input[1]) {
                logger.warn("No name provided in bday command");
                api.setMessageReaction("❌", messageID, () => {}, true);
                return api.sendMessage(
                    `${config.bot.botName}: ❌ Please provide a name. Example: {pn}bday @username | Name`,
                    threadID,
                    messageID
                );
            }

            const name = input[1];
            const imageUrl = `https://graph.facebook.com/${mentionedUserID}/picture?width=512&height=512&access_token=${ACCESS_TOKEN}`;
            const apiUrl = `${BDAY_API_URL}?name=${encodeURIComponent(name)}&image=${encodeURIComponent(imageUrl)}`;

            logger.info(`Generating birthday image for ${name} with profile picture of user ${mentionedUserID}`);
            const response = await axios.get(apiUrl, { timeout: 30000 });

            if (!response.data || !response.data.status || !response.data.url) {
                throw new Error(response.data.message || "Failed to generate birthday image");
            }

            const imageUrlFromResponse = response.data.url;
            logger.info(`Birthday image generated: ${imageUrlFromResponse}`);

          
            const imageResponse = await axios.get(imageUrlFromResponse, {
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
            const fileName = `bday_${crypto.randomBytes(8).toString('hex')}.png`;
            filePath = path.join(tempDir, fileName);

    
            const writer = fs.createWriteStream(filePath);
            imageResponse.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

       
            const stats = fs.statSync(filePath);
            if (stats.size === 0) throw new Error("Downloaded birthday image is empty");

          
            const randomWish = BIRTHDAY_WISHES[Math.floor(Math.random() * BIRTHDAY_WISHES.length)].replace("{name}", name);

           
            const senderInfo = await new Promise((resolve, reject) => {
                api.getUserInfo([senderID], (err, info) => {
                    if (err) reject(err);
                    else resolve(info);
                });
            });
            const userName = senderInfo[senderID]?.name || "Unknown User";

           
            const msg = {
                body: `${config.bot.botName}: ${randomWish}`,
                attachment: fs.createReadStream(filePath)
            };

            logger.info(`Sending birthday wish to ${name} in thread ${threadID}`);
            await new Promise((resolve, reject) => {
                api.sendMessage(msg, threadID, (err) => {
                    if (err) return reject(err);
                    api.setMessageReaction("🎂", messageID, () => {}, true);
                    resolve();
                }, messageID);
            });
            logger.info("Birthday wish sent successfully");

      
            fs.unlinkSync(filePath);
            logger.info(`[Bday Command] Sent birthday wish to ${name} for ${userName}`);
        } catch (err) {
            logger.error(`Error in bday command: ${err.message}`, { stack: err.stack });

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