const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createCanvas, loadImage, registerFont } = require('canvas');

// ====== CONFIG ZONE ======
const ACCESS_TOKEN = '6628568379|c1e620fa708a1d5696fb991c1bde5662'; 
// ==========================

module.exports = {
    name: "newspaper",
    version: "1.0.0",
    author: "Hridoy",
    description: "Generate a custom newspaper front page with your own headline and photo 📰",
    adminOnly: false,
    commandCategory: "Fun",
    guide: "Use {pn}newspaper [headline] | [subheading] | [article text] to create a newspaper. You can mention someone to use their profile picture.",
    cooldowns: 10,
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
            
            logger.info(`Received command: .newspaper for user ${targetID} in thread ${threadID}`);

         
            const inputText = args.join(" ").replace(targetName, "").trim();
            let headline = "BREAKING NEWS";
            let subheading = "Local resident makes headlines with extraordinary discovery";
            let articleText = "In a surprising turn of events, a local resident has made an extraordinary discovery that has the whole town talking. Experts are calling it 'the find of the century' while neighbors express their amazement at the unexpected development.";
            
            if (inputText) {
                const parts = inputText.split("|").map(part => part.trim());
                if (parts[0]) headline = parts[0].toUpperCase();
                if (parts[1]) subheading = parts[1];
                if (parts[2]) articleText = parts[2];
            }
            
         
            headline = headline.substring(0, 80);
            subheading = subheading.substring(0, 120);
            articleText = articleText.substring(0, 800);
            
      
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
            const userName = user.name || "Anonymous";
            
        
            const profilePicUrl = `https://graph.facebook.com/${targetID}/picture?width=500&height=500&access_token=${ACCESS_TOKEN}`;
            const imageResponse = await axios.get(profilePicUrl, { responseType: 'arraybuffer' });
            const profilePic = await loadImage(Buffer.from(imageResponse.data));

    
            const newspaperBuffer = await createNewspaper(headline, subheading, articleText, profilePic, userName);

        
            const tempDir = path.join(__dirname, '..', '..', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const fileName = `newspaper_${crypto.randomBytes(8).toString('hex')}.png`;
            filePath = path.join(tempDir, fileName);

            fs.writeFileSync(filePath, newspaperBuffer);

          
            const msg = {
                body: `${config.bot.botName}: 📰 Extra! Extra! Read all about it! 📰`,
                attachment: fs.createReadStream(filePath)
            };

            logger.info(`Sending newspaper for user: ${userName}`);
            await new Promise((resolve, reject) => {
                api.sendMessage(msg, threadID, (err) => {
                    if (err) return reject(err);
                    api.setMessageReaction("📰", messageID, () => {}, true);
                    resolve();
                }, messageID);
            });
            logger.info("Newspaper sent successfully");

         
            fs.unlinkSync(filePath);
            logger.info(`[Newspaper Command] Generated newspaper for user: ${userName}`);
        } catch (err) {
            logger.error(`Error in newspaper command: ${err.message}`, { stack: err.stack });

        
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

     
        async function createNewspaper(headline, subheading, articleText, profilePic, userName) {
          
            const canvasWidth = 1200;
            const canvasHeight = 1600;
            const canvas = createCanvas(canvasWidth, canvasHeight);
            const ctx = canvas.getContext('2d');

         
            ctx.fillStyle = '#f5f5f0';
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            
          
            ctx.globalAlpha = 0.03;
            for (let i = 0; i < canvasWidth; i += 4) {
                for (let j = 0; j < canvasHeight; j += 4) {
                    if (Math.random() > 0.5) {
                        ctx.fillStyle = '#000000';
                        ctx.fillRect(i, j, 1, 1);
                    }
                }
            }
            ctx.globalAlpha = 1;
            
        
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.strokeRect(20, 20, canvasWidth - 40, canvasHeight - 40);
            
       
            const newspaperName = "THE DAILY CHRONICLE";
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 80px "Times New Roman", serif';
            ctx.textAlign = 'center';
            ctx.fillText(newspaperName, canvasWidth / 2, 100);
            
      
            ctx.font = 'italic 24px "Times New Roman", serif';
            ctx.fillText('"All the news that\'s fit to print"', canvasWidth / 2, 140);
            
    const today = new Date();
            const dateStr = today.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            const issueInfo = `Vol. CXVII No. ${Math.floor(Math.random() * 1000)}`;
            
            ctx.font = '24px "Times New Roman", serif';
            ctx.textAlign = 'left';
            ctx.fillText(dateStr, 50, 180);
            
            ctx.textAlign = 'right';
            ctx.fillText(issueInfo, canvasWidth - 50, 180);
            ctx.textAlign = 'left';
            
          
            ctx.beginPath();
            ctx.moveTo(40, 200);
            ctx.lineTo(canvasWidth - 40, 200);
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.stroke();
            
         
            const headlineSize = calculateFontSize(headline, 70, 50, canvasWidth - 100);
            ctx.font = `bold ${headlineSize}px "Times New Roman", serif`;
            
        
            const wrappedHeadline = wrapText(ctx, headline, canvasWidth - 100, headlineSize);
            let headlineY = 260;
            
            wrappedHeadline.forEach(line => {
                ctx.fillText(line, 50, headlineY);
                headlineY += headlineSize * 1.2;
            });
            
          
            ctx.font = 'bold italic 36px "Times New Roman", serif';
            const wrappedSubheading = wrapText(ctx, subheading, canvasWidth - 100, 36);
            let subheadingY = headlineY + 20;
            
            wrappedSubheading.forEach(line => {
                ctx.fillText(line, 50, subheadingY);
                subheadingY += 40;
            });
            
           
            const contentStartY = subheadingY + 40;
            
         
            const imageSize = 400;
            const imageX = (canvasWidth - imageSize) / 2;
            const imageY = contentStartY;
            
        
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.strokeRect(imageX - 2, imageY - 2, imageSize + 4, imageSize + 4);
            
           
            ctx.drawImage(profilePic, imageX, imageY, imageSize, imageSize);
            
          
            ctx.font = 'italic 24px "Times New Roman", serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${userName} at the center of today's top story`, canvasWidth / 2, imageY + imageSize + 30);
            ctx.textAlign = 'left';
            

            const articleStartY = imageY + imageSize + 70;
            
            
            const columnCount = 2;
            const columnWidth = (canvasWidth - 150) / columnCount;
            const columnGap = 50;
            
            ctx.font = '24px "Times New Roman", serif';
            
        
            ctx.font = 'italic 24px "Times New Roman", serif';
            ctx.fillText(`By Special Correspondent`, 50, articleStartY);
            
      
            ctx.font = '24px "Times New Roman", serif';
            let currentColumn = 0;
            let currentY = articleStartY + 40;
            
           
            const firstIndent = 40;
            
          
            const paragraphs = articleText.split('\n');
            
            for (let i = 0; i < paragraphs.length; i++) {
                const paragraph = paragraphs[i];
                const indent = i === 0 ? firstIndent : 0;
                
           
                const words = paragraph.split(' ');
                let line = '';
                
                for (let j = 0; j < words.length; j++) {
                    const testLine = line + words[j] + ' ';
                    const metrics = ctx.measureText(testLine);
                    const testWidth = metrics.width;
                    
                    if (testWidth > columnWidth - indent && j > 0) {
                  
                        ctx.fillText(line, 50 + (currentColumn * (columnWidth + columnGap)) + (line === '' ? indent : 0), currentY);
                        line = words[j] + ' ';
                        currentY += 30;
                        
                    
                        if (currentY > canvasHeight - 100) {
                            currentY = articleStartY + 40;
                            currentColumn++;
                            
                          
                            if (currentColumn >= columnCount) {
                                break;
                            }
                        }
                    } else {
                        line = testLine;
                    }
                }
                
            
                if (line.trim() !== '') {
                    ctx.fillText(line, 50 + (currentColumn * (columnWidth + columnGap)) + (line === paragraph ? indent : 0), currentY);
                    currentY += 30;
                }
                
              
                currentY += 15;
                
             
                if (currentY > canvasHeight - 100) {
                    currentY = articleStartY + 40;
                    currentColumn++;
                    
                
                    if (currentColumn >= columnCount) {
                        break;
                    }
                }
            }
            
     
            ctx.font = 'italic 24px "Times New Roman", serif';
            ctx.fillText('Continued on page 2...', canvasWidth - 300, canvasHeight - 50);
            
          
            ctx.font = '24px "Times New Roman", serif';
            ctx.textAlign = 'center';
            ctx.fillText('Page 1', canvasWidth / 2, canvasHeight - 50);
            
 
            ctx.textAlign = 'left';
            ctx.fillText('Price: $1.00', 50, canvasHeight - 50);
            
        
            return canvas.toBuffer('image/png');
        }
        
   
        function calculateFontSize(text, maxSize, minSize, maxWidth) {
            const ctx = createCanvas(1, 1).getContext('2d');
            let fontSize = maxSize;
            
            ctx.font = `bold ${fontSize}px "Times New Roman", serif`;
            let textWidth = ctx.measureText(text).width;
         
            while (textWidth > maxWidth && fontSize > minSize) {
                fontSize -= 2;
                ctx.font = `bold ${fontSize}px "Times New Roman", serif`;
                textWidth = ctx.measureText(text).width;
            }
            
            return fontSize;
        }
        
    
        function wrapText(ctx, text, maxWidth, fontSize) {
            const words = text.split(' ');
            const lines = [];
            let currentLine = '';
            
            for (let i = 0; i < words.length; i++) {
                const testLine = currentLine + words[i] + ' ';
                const metrics = ctx.measureText(testLine);
                const testWidth = metrics.width;
                
                if (testWidth > maxWidth && i > 0) {
                    lines.push(currentLine.trim());
                    currentLine = words[i] + ' ';
                } else {
                    currentLine = testLine;
                }
            }
            
            if (currentLine.trim() !== '') {
                lines.push(currentLine.trim());
            }
            
            return lines;
        }
    }
};