const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ====== CONFIG ZONE ======
const FBDL_API_URL = 'https://speedydl.hridoy.top/api/facebook';
// ==========================

module.exports = {
    name: "fbdl",
    version: "1.0.0",
    author: "Hridoy",
    description: "Download a Facebook video and send it to the user 📹",
    adminOnly: false,
    commandCategory: "Media",
    guide: "Use {pn}fbdl <video_url> to download a Facebook video.\n" +
           "Example: {pn}fbdl https://www.facebook.com/share/r/19xBwLDVsg/",
    cooldowns: 10,
    usePrefix: true,

    async execute({ api, event, args }) {
        const threadID = event.threadID;
        const messageID = event.messageID;
        const senderID = event.senderID;

        let filePath;

        try {
            if (!event || !threadID || !messageID) {
                logger.error("Invalid event object in fbdl command", { event });
                return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, threadID);
            }

            if (!args[0]) {
                logger.warn("No video URL provided in fbdl command");
                api.setMessageReaction("❌", messageID, () => {}, true);
                return api.sendMessage(
                    `${config.bot.botName}: ❌ Please provide a Facebook video URL. Example: {pn}fbdl <video_url>`,
                    threadID,
                    messageID
                );
            }

            const videoUrl = args[0].trim();
            if (!videoUrl.startsWith('https://') || !videoUrl.includes('facebook.com')) {
                logger.warn(`Invalid Facebook video URL provided: ${videoUrl}`);
                api.setMessageReaction("❌", messageID, () => {}, true);
                return api.sendMessage(
                    `${config.bot.botName}: ❌ Please provide a valid Facebook video URL.`,
                    threadID,
                    messageID
                );
            }

            logger.info(`Downloading Facebook video for URL: ${videoUrl} in thread ${threadID}`);

    
            const apiUrl = `${FBDL_API_URL}?url=${encodeURIComponent(videoUrl)}`;
            logger.info(`Calling FBDL API: ${apiUrl}`);
            const response = await axios.get(apiUrl, { timeout: 30000 });

            if (!response.data || !response.data.hd || !response.data.title) {
                logger.error(`FBDL API response: ${JSON.stringify(response.data)}`);
                throw new Error("Failed to fetch video details from the API");
            }

            const hdVideoUrl = response.data.hd;
            const videoTitle = response.data.title;
            logger.info(`HD video URL: ${hdVideoUrl}, Title: ${videoTitle}`);

           
            const videoResponse = await axios.get(hdVideoUrl, {
                responseType: 'stream',
                timeout: 60000 
            });

           
            const contentType = videoResponse.headers['content-type'];
            if (!contentType || !contentType.startsWith('video/')) {
                throw new Error("API response is not a video");
            }

          
            const tempDir = path.join(__dirname, '..', '..', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const fileName = `fbdl_${crypto.randomBytes(8).toString('hex')}.mp4`;
            filePath = path.join(tempDir, fileName);

         
            const writer = fs.createWriteStream(filePath);
            videoResponse.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

          
            const stats = fs.statSync(filePath);
            if (stats.size === 0) throw new Error("Downloaded video file is empty");

          
            const senderInfo = await new Promise((resolve, reject) => {
                api.getUserInfo([senderID], (err, info) => {
                    if (err) reject(err);
                    else resolve(info);
                });
            });
            const senderName = senderInfo[senderID]?.name || "Unknown User";

      
            const msg = {
                body: `${config.bot.botName}: 📹 ${videoTitle}`,
                attachment: fs.createReadStream(filePath)
            };

            logger.info(`Sending video "${videoTitle}" to ${senderName} in thread ${threadID}`);
            await new Promise((resolve, reject) => {
                api.sendMessage(msg, threadID, (err) => {
                    if (err) return reject(err);
                    api.setMessageReaction("📹", messageID, () => {}, true);
                    resolve();
                }, messageID);
            });
            logger.info("Video sent successfully");

    
            fs.unlinkSync(filePath);
            logger.info(`[FBDL Command] Sent video "${videoTitle}" to ${senderName}`);
        } catch (err) {
            logger.error(`Error in fbdl command: ${err.message}`, { stack: err.stack });

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