const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ====== CONFIG ZONE ======
const YTDL_API_URL = 'https://speedydl.hridoy.top/api/youtube';
// ==========================

module.exports = {
    name: "ytdl",
    version: "1.0.0",
    author: "Hridoy",
    description: "Download a YouTube video and send it to the user 📹",
    adminOnly: false,
    commandCategory: "Media",
    guide: "Use {pn}ytdl <video_url> to download a YouTube video.\n" +
           "Example: {pn}ytdl https://www.youtube.com/watch?v=aUut5qQECc4",
    cooldowns: 10,
    usePrefix: true,

    async execute({ api, event, args }) {
        const threadID = event.threadID;
        const messageID = event.messageID;
        const senderID = event.senderID;

        let filePath;

        try {
            if (!event || !threadID || !messageID) {
                logger.error("Invalid event object in ytdl command", { event });
                return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, threadID);
            }

            if (!args[0]) {
                logger.warn("No video URL provided in ytdl command");
                api.setMessageReaction("❌", messageID, () => {}, true);
                return api.sendMessage(
                    `${config.bot.botName}: ❌ Please provide a YouTube video URL. Example: {pn}ytdl <video_url>`,
                    threadID,
                    messageID
                );
            }

            const videoUrl = args[0].trim();
            if (!videoUrl.startsWith('https://') || (!videoUrl.includes('youtube.com') && !videoUrl.includes('youtu.be'))) {
                logger.warn(`Invalid YouTube video URL provided: ${videoUrl}`);
                api.setMessageReaction("❌", messageID, () => {}, true);
                return api.sendMessage(
                    `${config.bot.botName}: ❌ Please provide a valid YouTube video URL.`,
                    threadID,
                    messageID
                );
            }

            logger.info(`Downloading YouTube video for URL: ${videoUrl} in thread ${threadID}`);

     
            const apiUrl = `${YTDL_API_URL}?url=${encodeURIComponent(videoUrl)}`;
            logger.info(`Calling YTDL API: ${apiUrl}`);
            const response = await axios.get(apiUrl, { timeout: 30000 });

            if (!response.data || !response.data.video_hd || !response.data.title) {
                logger.error(`YTDL API response: ${JSON.stringify(response.data)}`);
                throw new Error("Failed to fetch video details from the API");
            }

            const hdVideoUrl = response.data.video_hd;
            const videoTitle = response.data.title;
            logger.info(`HD video URL: ${hdVideoUrl}, Title: ${videoTitle}`);

        
            const videoResponse = await axios.get(hdVideoUrl, {
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
            const fileName = `ytdl_${crypto.randomBytes(8).toString('hex')}.mp4`;
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
            logger.info(`[YTDL Command] Sent video "${videoTitle}" to ${senderName}`);
        } catch (err) {
            logger.error(`Error in ytdl command: ${err.message}`, { stack: err.stack });

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