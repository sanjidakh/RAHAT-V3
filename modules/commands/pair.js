const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ====== CONFIG ZONE ======
const PAIR_API_URL = 'https://nexalo-api.vercel.app/api/pair';
const ACCESS_TOKEN = '6628568379|c1e620fa708a1d5696fb991c1bde5662';
// ==========================

module.exports = {
    name: "pair",
    version: "1.0.0",
    author: "Hridoy",
    description: "Generate a pair image using the command user's profile picture and a random user's profile picture from the group ❤️",
    adminOnly: false,
    commandCategory: "Fun",
    guide: "Use {pn}pair to generate a pairing image with yourself and a random member from the group.\n" +
           "Example: {pn}pair",
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

        
            const threadInfo = await new Promise((resolve, reject) => {
                api.getThreadInfo(threadID, (err, info) => {
                    if (err) reject(err);
                    else resolve(info);
                });
            });

            if (!threadInfo || !threadInfo.participantIDs || threadInfo.participantIDs.length < 2) {
                return api.sendMessage(
                    `${config.bot.botName}: ❌ Unable to find enough participants in the group.`,
                    threadID,
                    messageID
                );
            }

         
            const participantIDs = threadInfo.participantIDs.filter(id => id !== senderID);
            const randomUserID = participantIDs[Math.floor(Math.random() * participantIDs.length)];

          
            const image1 = `https://graph.facebook.com/${senderID}/picture?width=512&height=512&access_token=${ACCESS_TOKEN}`;
            const image2 = `https://graph.facebook.com/${randomUserID}/picture?width=512&height=512&access_token=${ACCESS_TOKEN}`;
            const apiUrl = `${PAIR_API_URL}?image1=${encodeURIComponent(image1)}&image2=${encodeURIComponent(image2)}`;

            logger.info(`Sending request to Pair API: ${apiUrl}`);
            const pairResponse = await axios.get(apiUrl, { timeout: 30000 });

            if (!pairResponse.data || !pairResponse.data.status || !pairResponse.data.url) {
                throw new Error(pairResponse.data.message || "Failed to generate pair image");
            }

            const pairImageUrl = pairResponse.data.url;
            logger.info(`Pair image generated successfully. Downloading from URL: ${pairImageUrl}`);

            const imageResponse = await axios.get(pairImageUrl, { responseType: 'stream', timeout: 15000 });

            const tempDir = path.join(__dirname, '..', '..', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const fileName = `pair_${crypto.randomBytes(8).toString('hex')}.png`;
            const filePath = path.join(tempDir, fileName);

            const writer = fs.createWriteStream(filePath);
            imageResponse.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            const msg = {
                body: `${config.bot.botName}: ❤️ Here's your pairing image!`,
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
        }
    }
};