const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ====== CONFIG ZONE ======
const FB_COVER_API_URL = 'https://nexalo-api.vercel.app/api/facebook-cover-v2';
const ACCESS_TOKEN = '6628568379|c1e620fa708a1d5696fb991c1bde5662'; 
// ==========================

module.exports = {
    name: "cover3",
    version: "1.0.0",
    author: "Hridoy",
    description: "Generate a Facebook cover v2 image with username, last name, phone, email, location, and style 🎨",
    adminOnly: false,
    commandCategory: "Fun",
    guide: "Use {pn}cover3 username | last name | phone | email | location | {style 1 to 5} to create a cover with your profile picture.\n" +
           "Or use {pn}cover3 @username | username | last name | phone | email | location | {style 1 to 5} to use the mentioned user's profile picture.\n" +
           "Example: {pn}cover3 John | Doe | 123-456-7890 | john@example.com | New York | 1\n" +
           "Example: {pn}cover3 @username | John | Doe | 123-456-7890 | john@example.com | New York | 1",
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
            if (input.length < 6 || input.length > 7) {
                return api.sendMessage(
                    `${config.bot.botName}: Please provide input in the format: {pn}cover3 username | last name | phone | email | location | {style 1 to 5} or {pn}cover3 @username | username | last name | phone | email | location | {style 1 to 5}`,
                    threadID,
                    messageID
                );
            }

            let imageUserID = event.senderID;
            let username, lastName, phone, email, location, style;

            if (input.length === 7 && input[0].startsWith('@')) {
                const mention = event.mentions;
                if (!mention || Object.keys(mention).length === 0) {
                    throw new Error("No user mentioned or mention format is incorrect");
                }
                imageUserID = Object.keys(mention)[0];
                username = input[1];
                lastName = input[2];
                phone = input[3];
                email = input[4];
                location = input[5];
                style = input[6];
            } else if (input.length === 6) {
                username = input[0];
                lastName = input[1];
                phone = input[2];
                email = input[3];
                location = input[4];
                style = input[5];
            } else {
                return api.sendMessage(
                    `${config.bot.botName}: Please provide input in the format: {pn}cover3 username | last name | phone | email | location | {style 1 to 5} or {pn}cover3 @username | username | last name | phone | email | location | {style 1 to 5}`,
                    threadID,
                    messageID
                );
            }

            if (!username || !lastName || !phone || !email || !location || !style) {
                return api.sendMessage(
                    `${config.bot.botName}: Please provide all required details (username, last name, phone, email, location, and style). Example: {pn}cover3 John | Doe | 123-456-7890 | john@example.com | New York | 1`,
                    threadID,
                    messageID
                );
            }

            if (!/^[1-5]$/.test(style)) {
                return api.sendMessage(
                    `${config.bot.botName}: Style must be a number between 1 and 5. Example: {pn}cover3 John | Doe | 123-456-7890 | john@example.com | New York | 1`,
                    threadID,
                    messageID
                );
            }

            const imageUrl = `https://graph.facebook.com/${imageUserID}/picture?width=512&height=512&access_token=${ACCESS_TOKEN}`;
            const apiUrl = `${FB_COVER_API_URL}?image=${encodeURIComponent(imageUrl)}&name=${encodeURIComponent(username)}&lastname=${encodeURIComponent(lastName)}&email=${encodeURIComponent(email)}&phone=${encodeURIComponent(phone)}&location=${encodeURIComponent(location)}&style=${style}`;

            const coverResponse = await axios.get(apiUrl, { timeout: 30000, responseType: 'stream' });

            const tempDir = path.join(__dirname, '..', '..', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const fileName = `cover3_${crypto.randomBytes(8).toString('hex')}.png`;
            filePath = path.join(tempDir, fileName);

            const writer = fs.createWriteStream(filePath);
            coverResponse.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            const msg = {
                body: `${config.bot.botName}: 🎨 Here's your Facebook cover for "${username} ${lastName}" with phone: "${phone}", email: "${email}", location: "${location}", and style: "${style}"!`,
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