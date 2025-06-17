const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ====== CONFIG ZONE ======
const IGDL_API_URL = 'https://speedydl.hridoy.top/api/instagram';
// ==========================

module.exports = {
    name: "igdl",
    version: "1.0.1",
    author: "Hridoy",
    description: "Download an Instagram video and send it to the user 📹",
    adminOnly: false,
    commandCategory: "Media",
    guide: "Use {pn}igdl <video_url> to download an Instagram video.\n" +
           "Example: {pn}igdl https://www.instagram.com/reel/ABC123/",
    cooldowns: 10,
    usePrefix: true,

    async execute({ api, event, args }) {
        const threadID = event.threadID;
        const messageID = event.messageID;
        const senderID = event.senderID;

        let filePath;

        try {
            if (!event || !threadID || !messageID) {
                logger.error("Invalid event object in igdl command", { event });
                return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, threadID);
            }

            if (!args[0]) {
                logger.warn("No video URL provided in igdl command");
                api.setMessageReaction("❌", messageID, () => {}, true);
                return api.sendMessage(
                    `${config.bot.botName}: ❌ Please provide an Instagram video URL. Example: {pn}igdl <video_url>`,
                    threadID,
                    messageID
                );
            }

            const videoUrl = args[0].trim();
            if (!videoUrl.startsWith('https://') || !videoUrl.includes('instagram.com')) {
                logger.warn(`Invalid Instagram video URL provided: ${videoUrl}`);
                api.setMessageReaction("❌", messageID, () => {}, true);
                return api.sendMessage(
                    `${config.bot.botName}: ❌ Please provide a valid Instagram video URL.`,
                    threadID,
                    messageID
                );
            }

            logger.info(`Downloading Instagram video for URL: ${videoUrl} in thread ${threadID}`);

          
            const apiUrl = `${IGDL_API_URL}?url=${encodeURIComponent(videoUrl)}`;
            logger.info(`Calling IGDL API: ${apiUrl}`);
            const response = await axios.get(apiUrl, { timeout: 30000 });

            if (!response.data || !response.data.video || response.data.video.length === 0) {
                logger.error(`IGDL API response: ${JSON.stringify(response.data)}`);
                throw new Error("Failed to fetch video details from the API");
            }

            const videoDownloadUrl = response.data.video[0];
            logger.info(`Video URL: ${videoDownloadUrl}`);

        
            const videoResponse = await axios.get(videoDownloadUrl, {
                responseType: 'stream',
                timeout: 60000 
            });

        
            const contentType = videoResponse.headers['content-type'];
            if (!contentType || (!contentType.startsWith('video/') && contentType !== 'application/octet-stream')) {
                throw new Error(`API response has unexpected Content-Type: ${contentType}`);
            }

        
            const tempDir = path.join(__dirname, '..', '..', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const fileName = `igdl_${crypto.randomBytes(8).toString('hex')}.mp4`;
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
                body: `${config.bot.botName}: 📹 Here's your Instagram video!`,
                attachment: fs.createReadStream(filePath)
            };

            logger.info(`Sending Instagram video to ${senderName} in thread ${threadID}`);
            await new Promise((resolve, reject) => {
                api.sendMessage(msg, threadID, (err) => {
                    if (err) return reject(err);
                    api.setMessageReaction("📹", messageID, () => {}, true);
                    resolve();
                }, messageID);
            });
            logger.info("Instagram video sent successfully");


            fs.unlinkSync(filePath);
            logger.info(`[IGDL Command] Sent Instagram video to ${senderName}`);
        } catch (err) {
            logger.error(`Error in igdl command: ${err.message}`, { stack: err.stack });

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