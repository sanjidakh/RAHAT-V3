const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ====== CONFIG ZONE ======
const MUSIC_LIST_URL = 'https://raw.githubusercontent.com/1dev-hridoy/1dev-hridoy/refs/heads/main/randomsingcmdmusiclist.json';
const YTSEARCH_API_URL = 'https://nexalo-api.vercel.app/api/ytsearch';
const YTMP3DL_API_URL = 'https://nexalo-api.vercel.app/api/ytmp3dl';
// ==========================

module.exports = {
    name: "ransing",
    version: "1.0.3",
    author: "Hridoy",
    description: "Get a random song with its MP3 file 🎵",
    adminOnly: false,
    commandCategory: "Music",
    guide: "Use {pn}ransing to get a random song and its MP3 file.",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, getText }) {
        const threadID = event.threadID;
        const messageID = event.messageID;
        const senderID = event.senderID;

        let filePath;

        try {
            if (!event || !threadID || !messageID) {
                logger.error("Invalid event object in ransing command", { event });
                return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, threadID);
            }

            logger.info(`Received command: .ransing in thread ${threadID}`);

            logger.info(`Fetching music list from: ${MUSIC_LIST_URL}`);
            const musicListResponse = await axios.get(MUSIC_LIST_URL, { timeout: 30000 });
            const musicList = musicListResponse.data;

            if (!musicList.artists || musicList.artists.length === 0) {
                throw new Error("No artists found in the music list");
            }


            const randomArtist = musicList.artists[Math.floor(Math.random() * musicList.artists.length)];
            const randomSong = randomArtist.all_songs[Math.floor(Math.random() * randomArtist.all_songs.length)];
            const randomImage = randomArtist.images[Math.floor(Math.random() * randomArtist.images.length)];

            const artistName = randomArtist.name;
            const songName = randomSong;

   
            const songDetailsMsg = {
                body: `${config.bot.botName}: 🎵 Here's your random song!\nArtist: ${artistName}\nSong: ${songName}`,
                attachment: (await axios.get(randomImage, { responseType: 'stream' })).data
            };

            logger.info(`Sending song details: ${artistName} - ${songName}`);
            await api.sendMessage(songDetailsMsg, threadID);
            logger.info("Song details sent successfully");

      
            const query = encodeURIComponent(`${artistName} ${songName}`);
            const ytSearchUrl = `${YTSEARCH_API_URL}?query=${query}`;
            logger.info(`Sending YouTube search request: ${ytSearchUrl}`);

            const searchResponse = await axios.get(ytSearchUrl, { timeout: 10000 });

            if (!searchResponse.data || searchResponse.data.code !== 200 || !searchResponse.data.data || searchResponse.data.data.length === 0) {
                throw new Error("No music found for the given query");
            }

   
            const firstVideo = searchResponse.data.data[0];
            const videoUrl = firstVideo.url;
            const title = firstVideo.title;
            const duration = firstVideo.duration;

         
            const downloadUrl = `${YTMP3DL_API_URL}?url=${encodeURIComponent(videoUrl)}`;
            logger.info(`Sending MP3 download request: ${downloadUrl}`);

            const downloadResponse = await axios.get(downloadUrl, { timeout: 10000 });

            if (!downloadResponse.data || !downloadResponse.data.success || !downloadResponse.data.download_url) {
                throw new Error("Failed to retrieve MP3 download URL");
            }

            const mp3DownloadUrl = downloadResponse.data.download_url;
            logger.info(`Audio download URL: ${mp3DownloadUrl}`);

       
            const tempDir = path.join(__dirname, '..', '..', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const fileName = `ransing_${crypto.randomBytes(8).toString('hex')}.mp3`;
            filePath = path.join(tempDir, fileName);


            const mp3Response = await axios.get(mp3DownloadUrl, {
                responseType: 'stream',
                timeout: 15000
            });

            const contentType = mp3Response.headers['content-type'];
            if (!contentType || !contentType.startsWith('audio/')) {
                throw new Error("Downloaded content is not an audio file");
            }

    
            const writer = fs.createWriteStream(filePath);
            mp3Response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

       
            const stats = fs.statSync(filePath);
            if (stats.size === 0) throw new Error("Downloaded MP3 file is empty");

      
            const userInfo = await new Promise((resolve, reject) => {
                api.getUserInfo([senderID], (err, info) => {
                    if (err) reject(err);
                    else resolve(info);
                });
            });
            const userName = userInfo[senderID]?.name || "Unknown User";

        
            const msg = {
                body: `${config.bot.botName}: 🎧 Here's the audio for "${title}" (${duration})!`,
                attachment: fs.createReadStream(filePath)
            };

            logger.info(`Sending audio file for: ${artistName} - ${songName}`);
            await new Promise((resolve, reject) => {
                api.sendMessage(msg, threadID, (err) => {
                    if (err) return reject(err);
                    api.setMessageReaction("🎵", messageID, () => {}, true);
                    resolve();
                }, messageID);
            });
            logger.info("Audio file sent successfully");

     
            fs.unlinkSync(filePath);
            logger.info(`[Ransing Command] Downloaded "${title}" (${duration}) for ${userName}`);
        } catch (err) {
            logger.error(`Error in ransing command: ${err.message}`, { stack: err.stack });

     
            api.setMessageReaction("❌", messageID, () => {}, true);
            await api.sendMessage(
                `${config.bot.botName}: ⚠️ Error: ${err.message}\nYou can listen to the song here: ${videoUrl || 'Not available'}`,
                threadID,
                messageID
            );

         
            if (filePath && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
    }
};