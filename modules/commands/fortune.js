const config = require('../../config/config.json');
const logger = require('../../includes/logger');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createCanvas, loadImage } = require('canvas');

module.exports = {
    name: "fortune",
    version: "1.0.0",
    author: "Hridoy",
    description: "Get your fortune from a digital fortune cookie 🥠",
    adminOnly: false,
    commandCategory: "Fun",
    guide: "Use {pn}fortune to receive a fortune cookie prediction. Add 'love', 'success', 'health', or 'wealth' for a specific type of fortune.",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
        const threadID = event.threadID;
        const messageID = event.messageID;
        const senderID = event.senderID;

        let filePath;

        try {
           
            let fortuneType = "general";
            const validTypes = ["love", "success", "health", "wealth"];
            
            if (args.length > 0 && validTypes.includes(args[0].toLowerCase())) {
                fortuneType = args[0].toLowerCase();
            }
            
            logger.info(`Received command: .fortune with type: ${fortuneType} from user ${senderID}`);

            
            const userInfo = await new Promise((resolve, reject) => {
                api.getUserInfo([senderID], (err, info) => {
                    if (err) reject(err);
                    else resolve(info);
                });
            });
            
            if (!userInfo || !userInfo[senderID]) {
                throw new Error("Failed to fetch user information");
            }
            
            const userName = userInfo[senderID].name || "Friend";
            const firstName = userName.split(' ')[0];
            
        
            const fortuneContent = generateFortune(fortuneType, firstName);
            
          
            const fortuneBuffer = await createFortuneCookie(fortuneContent);

          
            const tempDir = path.join(__dirname, '..', '..', 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            const fileName = `fortune_${crypto.randomBytes(8).toString('hex')}.png`;
            filePath = path.join(tempDir, fileName);

            fs.writeFileSync(filePath, fortuneBuffer);

            
            const msg = {
                body: `${config.bot.botName}: 🥠 Your fortune cookie has arrived, ${firstName}! 🥠`,
                attachment: fs.createReadStream(filePath)
            };

            logger.info(`Sending fortune cookie for user: ${userName}`);
            await new Promise((resolve, reject) => {
                api.sendMessage(msg, threadID, (err) => {
                    if (err) return reject(err);
                    api.setMessageReaction("🥠", messageID, () => {}, true);
                    resolve();
                }, messageID);
            });
            logger.info("Fortune cookie sent successfully");

           
            fs.unlinkSync(filePath);
            logger.info(`[Fortune Command] Generated fortune cookie for user: ${userName}`);
        } catch (err) {
            logger.error(`Error in fortune command: ${err.message}`, { stack: err.stack });

        
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

    
        function generateFortune(type, name) {
          
            const fortunes = {
                general: [
                    "A beautiful, smart, and loving person will be coming into your life.",
                    "Your creativity will make you successful in a most unexpected way.",
                    "Your hard work is about to pay off. Remember, dreams are illustrations from the book your soul is writing about you.",
                    "A lifetime of happiness awaits you.",
                    "A pleasant surprise is waiting for you.",
                    "Adventure can be real happiness.",
                    "All the effort you are making will ultimately pay off.",
                    "All will go well with your new project.",
                    "Any day above ground is a good day.",
                    "Believe it can be done.",
                    "Believe in yourself and others will too.",
                    "Change is happening in your life, so go with the flow!",
                    "Curiosity kills boredom. Nothing kills curiosity.",
                    "Don't just spend time. Invest it.",
                    "Don't just think, act!",
                    "Don't worry about money. The best things in life are free.",
                    "Every wise person started out by asking many questions.",
                    "Failure is the chance to do better next time.",
                    "Feeding a cow with roses does not get extra appreciation.",
                    "Go take a rest; you deserve it.",
                    "Good news will come to you by mail.",
                    "Good things are being said about you.",
                    "Happiness begins with facing life with a smile and a wink.",
                    "If you continually give, you will continually have.",
                    "If you look in the right places, you can find some good offerings.",
                    "If you think you can do a thing or think you can't do a thing, you're right.",
                    "It is better to be an optimist and proven a fool than to be a pessimist and be proven right.",
                    "It is honorable to stand up for what is right, however unpopular it seems.",
                    "It's time to get moving. Your spirits will lift accordingly.",
                    "Listen to everyone. Ideas come from everywhere.",
                    "Love is a warm fire to keep the soul warm.",
                    "Never give up. You're not a failure if you don't give up.",
                    "Now is a good time to try something new.",
                    "Physical activity will dramatically improve your outlook today.",
                    "Practice makes perfect.",
                    "Protective measures will prevent costly disasters.",
                    "Put your mind into planning today. Look into the future.",
                    "Rest has a peaceful effect on your physical and emotional health.",
                    "Resting well is as important as working hard.",
                    "Savor your freedom – it is precious.",
                    "Say hello to others. You will have a happier day.",
                    "Self-knowledge is a life-long process.",
                    "Sometimes you just need to lay on the floor.",
                    "Success is a journey, not a destination.",
                    "The greatest achievement in life is to stand up again after falling.",
                    "The smart thing to do is to begin trusting your intuitions.",
                    "There is no greater pleasure than seeing your loved ones prosper.",
                    "There is no wisdom greater than kindness.",
                    "You are almost there.",
                    "You are busy, but you are happy.",
                    "You are generous to an extreme and always think of the other fellow.",
                    "You are going to have some new clothes.",
                    "You are talented in many ways.",
                    "You are the center of every group's attention.",
                    "You are very expressive and positive in words, act and feeling.",
                    "You can make your own happiness.",
                    "You can see a lot just by looking.",
                    "You have a deep interest in all that is artistic.",
                    "You have a friendly heart and are well admired.",
                    "You have an active mind and a keen imagination.",
                    "You have the power to write your own fortune.",
                    "Your dreams are worth your best efforts to achieve them.",
                    "Your energy returns and you get things done.",
                    "Your goal will be reached very soon.",
                    "Your happiness is intertwined with your outlook on life.",
                    "Your hard work will payoff today.",
                    "Your heart will always make itself known through your words.",
                    "Your home is the center of great love.",
                    "Your infinite capacity for patience will be rewarded sooner or later.",
                    "Your leadership qualities will be tested and proven.",
                    "Your life will be happy and peaceful.",
                    "Your life will get more and more exciting.",
                    "Your love life will be happy and harmonious.",
                    "Your mind is creative, original and alert.",
                    "Your quick wits will get you out of a tough situation.",
                    "Your reputation is your wealth."
                ],
                love: [
                    "The love of your life will appear in front of you unexpectedly!",
                    "Your heart will skip a beat when someone special walks into your life.",
                    "A romantic relationship takes a positive turn.",
                    "Love is like wildflowers... it's often found in the most unlikely places.",
                    "The love you give is the love you get.",
                    "Your heart is a place to draw true happiness.",
                    "Love, because it is the only true adventure.",
                    "The love of your life is stepping into your planet this summer.",
                    "An old love will come back to you.",
                    "Your love life will soon be harmonious and full of excitement.",
                    "Follow what calls you, that's where your love is.",
                    "A very attractive person has a message for you.",
                    "Love asks you to trust what your heart tells you.",
                    "The greatest love is love that grows through time.",
                    "Your ability to love will bring someone special into your life.",
                    "Love is the triumph of imagination over intelligence.",
                    "You will know when true love finds you.",
                    "A chance meeting opens a new door to love and friendship.",
                    "The love that you've been giving will soon be returned to you.",
                    "Your heart is pure, and your mind clear, and your soul devout."
                ],
                success: [
                    "Your hard work is about to pay off. Remember, dreams are illustrations from the book your soul is writing about you.",
                    "Your talents will be recognized and suitably rewarded.",
                    "Your success will astonish everyone.",
                    "You will soon be the center of attention.",
                    "Your ability to juggle many tasks will take you far.",
                    "Your success is written in the stars.",
                    "Determination is what you need now.",
                    "You will conquer obstacles to achieve success.",
                    "Success is a journey, not a destination.",
                    "Success is failure turned inside out.",
                    "Your success will be obvious to everyone.",
                    "Your mentality is alert, practical, and analytical.",
                    "Your dynamic and efficient mind will lead you to success.",
                    "Your dream will come true when you least expect it.",
                    "Your many hidden talents will become obvious to those around you.",
                    "Your ingenuity and imagination will get results.",
                    "Your leadership qualities will be tested and proven.",
                    "Your problem just got bigger. Think, what have you done?",
                    "Your talents will be recognized and rewarded.",
                    "Your greatest fortune is the large number of friends you have."
                ],
                health: [
                    "A healthy body will benefit your mind and soul.",
                    "Meditation will lead you to a clear perspective.",
                    "Your health will improve as you take small steps each day.",
                    "A balanced diet and regular exercise will keep you healthy.",
                    "Good health is a state of mind and body.",
                    "Your health improves as you laugh more often.",
                    "Rest is as important as work for your health.",
                    "Your body hears everything your mind says.",
                    "A healthy outside starts from the inside.",
                    "Take care of your body. It's the only place you have to live.",
                    "Your health is your wealth.",
                    "Happiness is the highest form of health.",
                    "Physical activity will dramatically improve your outlook today.",
                    "Your body's ability to heal is greater than anyone has permitted you to believe.",
                    "Health and happiness go hand in hand.",
                    "Your body is a reflection of your lifestyle.",
                    "A healthy mind breeds a healthy body.",
                    "Your health will improve through mindful choices.",
                    "The greatest wealth is health.",
                    "Your health will benefit from genuine laughter."
                ],
                wealth: [
                    "Wealth awaits you very soon.",
                    "An unexpected windfall will boost your finances.",
                    "Your financial prospects are looking up.",
                    "Money will come to you when you are doing the right thing.",
                    "Your financial future is looking bright.",
                    "A small investment will pay off handsomely.",
                    "Wealth is of the heart and mind, not the pocket.",
                    "Financial prosperity is coming your way.",
                    "Your financial worries will soon be behind you.",
                    "A lifetime of happiness awaits you with financial security.",
                    "Your income will increase substantially very soon.",
                    "A golden egg of opportunity falls into your lap this month.",
                    "Your financial situation will improve dramatically.",
                    "Money will soon flow into your life like a river.",
                    "Your wealth is where your friends are.",
                    "Prosperity is in your future.",
                    "Your financial investments will pay off.",
                    "A surprising financial opportunity will present itself to you.",
                    "Your wealth is measured by the lives you've touched.",
                    "Financial freedom is within your reach."
                ]
            };
            
        
            const selectedFortunes = fortunes[type] || fortunes.general;
            const fortune = selectedFortunes[Math.floor(Math.random() * selectedFortunes.length)];
            
         
            const luckyNumbers = [];
            while (luckyNumbers.length < 6) {
                const num = Math.floor(Math.random() * 49) + 1;
                if (!luckyNumbers.includes(num)) {
                    luckyNumbers.push(num);
                }
            }
            luckyNumbers.sort((a, b) => a - b);
            
          
            const zodiacAnimals = [
                "Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake",
                "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig"
            ];
            const zodiacAnimal = zodiacAnimals[Math.floor(Math.random() * zodiacAnimals.length)];
            
     
            const chineseWords = [
                { word: "友谊", pinyin: "yǒu yì", meaning: "friendship" },
                { word: "爱", pinyin: "ài", meaning: "love" },
                { word: "幸福", pinyin: "xìng fú", meaning: "happiness" },
                { word: "健康", pinyin: "jiàn kāng", meaning: "health" },
                { word: "成功", pinyin: "chéng gōng", meaning: "success" },
                { word: "财富", pinyin: "cái fù", meaning: "wealth" },
                { word: "智慧", pinyin: "zhì huì", meaning: "wisdom" },
                { word: "和平", pinyin: "hé píng", meaning: "peace" },
                { word: "勇气", pinyin: "yǒng qì", meaning: "courage" },
                { word: "希望", pinyin: "xī wàng", meaning: "hope" },
                { word: "梦想", pinyin: "mèng xiǎng", meaning: "dream" },
                { word: "家庭", pinyin: "jiā tíng", meaning: "family" },
                { word: "耐心", pinyin: "nài xīn", meaning: "patience" },
                { word: "诚实", pinyin: "chéng shí", meaning: "honesty" },
                { word: "善良", pinyin: "shàn liáng", meaning: "kindness" }
            ];
            const chineseWord = chineseWords[Math.floor(Math.random() * chineseWords.length)];
            
        
            return {
                fortune: fortune.replace(/you/gi, name).replace(/your/gi, `${name}'s`),
                luckyNumbers: luckyNumbers.join(" - "),
                zodiacAnimal: zodiacAnimal,
                chineseWord: chineseWord
            };
        }

    
        async function createFortuneCookie(fortuneContent) {
         
            const canvasWidth = 800;
            const canvasHeight = 500;
            const canvas = createCanvas(canvasWidth, canvasHeight);
            const ctx = canvas.getContext('2d');

            try {
     
                ctx.fillStyle = '#f9f2e7';
                ctx.fillRect(0, 0, canvasWidth, canvasHeight);
                
        
                ctx.globalAlpha = 0.05;
                for (let i = 0; i < canvasWidth; i += 4) {
                    for (let j = 0; j < canvasHeight; j += 4) {
                        if (Math.random() > 0.5) {
                            ctx.fillStyle = '#000000';
                            ctx.fillRect(i, j, 1, 1);
                        }
                    }
                }
                ctx.globalAlpha = 1;
                
              
                ctx.fillStyle = '#ffffff';
                roundRect(ctx, 50, 50, canvasWidth - 100, canvasHeight - 100, 10, true);
                
          
                ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
                ctx.shadowBlur = 15;
                ctx.shadowOffsetX = 5;
                ctx.shadowOffsetY = 5;
                roundRect(ctx, 50, 50, canvasWidth - 100, canvasHeight - 100, 10, false, true);
                ctx.shadowColor = 'transparent';
                
             
                ctx.strokeStyle = '#e8c48e';
                ctx.lineWidth = 2;
                roundRect(ctx, 70, 70, canvasWidth - 140, canvasHeight - 140, 5, false, true);
                
             
                drawFortuneCookieIcon(ctx, 400, 90, 60);
                
          
                ctx.fillStyle = '#333333';
                ctx.font = 'italic 24px "Times New Roman", serif';
                ctx.textAlign = 'center';
                
           
                const wrappedFortune = wrapText(ctx, fortuneContent.fortune, canvasWidth - 200, 24);
                let fortuneY = 170;
                
                wrappedFortune.forEach(line => {
                    ctx.fillText(line, canvasWidth / 2, fortuneY);
                    fortuneY += 30;
                });
                
         
                ctx.strokeStyle = '#e8c48e';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(150, fortuneY + 20);
                ctx.lineTo(canvasWidth - 150, fortuneY + 20);
                ctx.stroke();
                
          
                ctx.fillStyle = '#cc0000';
                ctx.font = 'bold 28px Arial, sans-serif';
                ctx.fillText(`Lucky Numbers: ${fortuneContent.luckyNumbers}`, canvasWidth / 2, fortuneY + 60);
                
            
                ctx.fillStyle = '#333333';
                ctx.font = '24px Arial, sans-serif';
                ctx.fillText(`Your Chinese Zodiac: ${fortuneContent.zodiacAnimal}`, canvasWidth / 2, fortuneY + 100);
                
           
                ctx.fillStyle = '#cc0000';
                ctx.font = 'bold 24px Arial, sans-serif';
                ctx.fillText("Learn Chinese", canvasWidth / 2, fortuneY + 140);
                
                ctx.fillStyle = '#333333';
                ctx.font = '28px "Arial", sans-serif';
                ctx.fillText(fortuneContent.chineseWord.word, canvasWidth / 2, fortuneY + 180);
                
                ctx.font = 'italic 20px Arial, sans-serif';
                ctx.fillText(`${fortuneContent.chineseWord.pinyin} - ${fortuneContent.chineseWord.meaning}`, canvasWidth / 2, fortuneY + 210);
                
            
                ctx.font = '16px Arial, sans-serif';
                ctx.fillStyle = '#888888';
                ctx.textAlign = 'center';
                ctx.fillText(`${config.bot.botName} Fortune Cookies - ${new Date().toLocaleDateString()}`, canvasWidth / 2, canvasHeight - 70);
                
             
                return canvas.toBuffer('image/png');
            } catch (error) {
                logger.error(`Error creating fortune cookie: ${error.message}`);
                throw new Error('Failed to create fortune cookie.');
            }
        }
        
     
        function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
            if (typeof stroke === 'undefined') {
                stroke = false;
            }
            if (typeof radius === 'undefined') {
                radius = 5;
            }
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + width - radius, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
            ctx.lineTo(x + width, y + height - radius);
            ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            ctx.lineTo(x + radius, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
            if (fill) {
                ctx.fill();
            }
            if (stroke) {
                ctx.stroke();
            }
        }
        
   
        function drawFortuneCookieIcon(ctx, x, y, size) {
      
            ctx.fillStyle = '#e8c48e';
            
    
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        
            ctx.fillStyle = '#d4b27a';
            ctx.beginPath();
            ctx.arc(x + 10, y + 10, size - 10, 0, Math.PI * 2);
            ctx.fill();
            
           
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x - size/3, y - size/8, size/1.5, size/4);
            
      
            ctx.strokeStyle = '#c4a068';
            ctx.lineWidth = 1;
            
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                ctx.moveTo(x - size/2 + Math.random() * size, y - size/2 + Math.random() * size);
                ctx.lineTo(x - size/2 + Math.random() * size, y - size/2 + Math.random() * size);
                ctx.stroke();
            }
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