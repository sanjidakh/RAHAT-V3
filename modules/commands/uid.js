const config = require('../../config/config.json');

module.exports = {
    name: "uid",
    version: "1.0.0",
    author: "Hridoy",
    description: "Shows the UID of the user, a mentioned user, or the replied-to user.",
    adminOnly: false,
    commandCategory: "utility",
    guide: "Use {pn}uid to get your UID, {pn}uid @username to get a mentioned user's UID, or reply to a message with {pn}uid to get that user's UID.",
    cooldowns: 5,
    usePrefix: true,

    async execute({ api, event, args }) {
      
        if (!event || !event.threadID || !event.messageID) {
            console.error("Invalid event object in uid command");
            return api.sendMessage(`${config.bot.botName}: ❌ Invalid event data.`, event.threadID);
        }

        let targetUid;
        let targetName = "User";

        try {
       
            if (event.type === "message_reply" && event.messageReply) {
                targetUid = event.messageReply.senderID;
                const userInfo = await new Promise((resolve) => {
                    api.getUserInfo(targetUid, (err, info) => resolve(err ? {} : info));
                });
                targetName = userInfo[targetUid]?.name || "Replied User";
            }
  
            else if (event.mentions && Object.keys(event.mentions).length > 0) {
                const mentionedUsers = Object.keys(event.mentions);
                if (mentionedUsers.length > 1) {
                    return api.sendMessage(`${config.bot.botName}: Please mention only one user.`, event.threadID, event.messageID);
                }
                targetUid = mentionedUsers[0];
                targetName = event.mentions[targetUid] || "Mentioned User";
            }
 
            else {
                targetUid = event.senderID;
                const userInfo = await new Promise((resolve) => {
                    api.getUserInfo(targetUid, (err, info) => resolve(err ? {} : info));
                });
                targetName = userInfo[targetUid]?.name || "You";
            }


            await api.sendMessage(
                `${config.bot.botName}: ${targetName}'s UID: ${targetUid}`,
                event.threadID,
                event.messageID
            );
        } catch (error) {
            console.error("❌ Error in uid command:", error);
            await api.sendMessage(
                `${config.bot.botName}: ❌ Failed to retrieve UID.`,
                event.threadID,
                event.messageID
            );
        }
    }
};