const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createCanvas, loadImage } = require('canvas');

// ====== CONFIG ZONE ======
const ACCESS_TOKEN = '6628568379|c1e620fa708a1d5696fb991c1bde5662'; 
// ==========================

module.exports = {
    name: "cover4",
    version: "1.0.0",
    author: "Hridoy",
    description: "Generate a stylish Facebook cover with your name and profile picture 🖼️",
    adminOnly: false,
    commandCategory: "Fun",
    guide: "Use {pn}cover4 [name] | [subtitle] | [description] to create a cover. You can mention someone to use their profile picture.",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        const threadID = event.threadID;
        const messageID = event.messageID;
        const senderID = event.senderID;

        let filePath;

        try {
         


            let targetID = senderID; 
            let targetName = "";
            
     
            const mentionedUsers = Object.keys(event.mentions || {});
            if (mentionedUsers.length > 0) {
                targetID = mentionedUsers[0];
                targetName = event.mentions[targetID];
            }
            
            logger.info(`Received command: .cover4 for user ${targetID} in thread ${threadID}`);

          
            const inputText = args.join(" ").replace(targetName, "").trim();
            let name = "Your Name";
            let subtitle = "Subtitle Here";
            let description = "Your description or tagline goes here";
            
            if (inputText) {
                const parts = inputText.split("|").map(part => part.trim());
                if (parts[0]) name = parts[0];
                if (parts[1]) subtitle = parts[1];
                if (parts[2]) description = parts[2];
            }
            
        
            const userInfo = await new Promise((resolve, reject) => {
                api.getUserInfo([targetID], (err, info) => {
                    if (err) reject(err);
                    else resolve(info);
                });
            });
            
            if (!userInfo || !userInfo[targetID]) {
                throw new Error("Failed to fetch user information");
            }
            
            const user = userInfo[targetID];
            
       
            if (name === "Your Name" && user.name) {
                name = user.name;
            }
            
        
            const profilePicUrl = `https://graph.facebook.com/${targetID}/picture?width=500&height=500&access_token=${ACCESS_TOKEN}`;
            const imageResponse = await axios.get(profilePicUrl, { responseType: 'arraybuffer' });
            const profilePic = await loadImage(Buffer.from(imageResponse.data));

      
            

            const canvasWidth = 851;
            const canvasHeight = 315;
            const canvas = createCanvas(canvasWidth, canvasHeight);
            const ctx = canvas.getContext('2d');

           
            const gradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
            gradient.addColorStop(0, '#4b6cb7');
            gradient.addColorStop(1, '#182848');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            
         
            ctx.save();
            ctx.globalAlpha = 0.1;
            
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.moveTo(0, 100 + i * 70);
                
                for (let x = 0; x < canvasWidth; x += 20) {
                    const y = 100 + i * 70 + Math.sin(x / 50) * 20;
                    ctx.lineTo(x, y);
                }
                
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 5;
                ctx.stroke();
            }
            
            ctx.restore();
            
         
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(0, 0, canvasWidth * 0.6, canvasHeight);
            
        
            const picSize = 180;
            const picX = canvasWidth - picSize - 40;
            const picY = (canvasHeight - picSize) / 2;
            
            
            ctx.save();
            ctx.beginPath();
            ctx.arc(picX + picSize/2, picY + picSize/2, picSize/2, 0, Math.PI * 2);
            ctx.clip();
            
          
            ctx.drawImage(profilePic, picX, picY, picSize, picSize);
            ctx.restore();
            
        
            ctx.beginPath();
            ctx.arc(picX + picSize/2, picY + picSize/2, picSize/2, 0, Math.PI * 2);
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
            
         
            ctx.beginPath();
            ctx.arc(picX + picSize/2, picY + picSize/2, picSize/2 + 5, 0, Math.PI * 2);
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.stroke();
            
        
            ctx.font = 'bold 48px Arial, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 10;
            ctx.fillText(name.substring(0, 20), 40, 100);
            
         
            ctx.font = 'italic 24px Arial, sans-serif';
            ctx.fillStyle = '#e0e0e0';
            ctx.fillText(subtitle.substring(0, 30), 40, 140);
            
       
            ctx.font = '18px Arial, sans-serif';
            ctx.fillStyle = '#cccccc';
            ctx.shadowBlur = 5;
            
         
            const maxWidth = canvasWidth * 0.5;
            const words = description.split(' ');
            let line = '';
            let y = 180;
            
            for (let i = 0; i < words.length; i++) {
                const testLine = line + words[i] + ' ';
                const metrics = ctx.measureText(testLine);
                const testWidth = metrics.width;
                
                if (testWidth > maxWidth && i > 0) {
                    ctx.fillText(line, 40, y);
                    line = words[i] + ' ';
                    y += 25;
                    
               
                    if (y > 255) {
                        if (i < words.length - 1) {
                            line += '...';
                        }
                        break;
                    }
                } else {
                    line = testLine;
                }
            }
            
            ctx.fillText(line, 40, y);
            ctx.shadowBlur = 0;
            
      
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(0, canvasHeight - 30, canvasWidth, 30);
            
        
            const timestamp = new Date().toLocaleDateString();
            ctx.font = '14px Arial, sans-serif';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.textAlign = 'right';
            ctx.fillText(`Created: ${timestamp}`, canvasWidth - 20, canvasHeight - 10);
            
            ctx.textAlign = 'left';
            ctx.fillText(`${config.bot.botName}`, 20, canvasHeight - 10);

      
            const tempDir = path.join(__dirname, '..', '..', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const fileName = `cover_${crypto.randomBytes(8).toString('hex')}.png`;
            filePath = path.join(tempDir, fileName);

            const out = fs.createWriteStream(filePath);
            const stream = canvas.createPNGStream({ quality: 0.95 });
            stream.pipe(out);

            await new Promise((resolve, reject) => {
                out.on('finish', resolve);
                out.on('error', reject);
            });

       
            const stats = fs.statSync(filePath);
            if (stats.size === 0) throw new Error("Generated image file is empty");

       
            const msg = {
                body: `${config.bot.botName}: ✨ Here's your Facebook cover! ✨`,
                attachment: fs.createReadStream(filePath)
            };

            logger.info(`Sending Facebook cover for user: ${targetID}`);
            await new Promise((resolve, reject) => {
                api.sendMessage(msg, threadID, (err) => {
                    if (err) return reject(err);
                    api.setMessageReaction("🖼️", messageID, () => {}, true);
                    resolve();
                }, messageID);
            });
            logger.info("Facebook cover sent successfully");

         
            fs.unlinkSync(filePath);
            logger.info(`[Cover4 Command] Generated Facebook cover for user: ${targetID}`);
        } catch (err) {
            logger.error(`Error in cover4 command: ${err.message}`, { stack: err.stack });

           
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