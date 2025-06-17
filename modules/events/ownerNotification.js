const logger = require('../../includes/logger');
const config = require('../../config/config.json');

class OwnerNotification {
  constructor(api) {
    this.api = api;
    this.ownerUid = config.bot.ownerUid;
    this.botName = config.bot.botName;
  }

  start() {
    const onlineMessage = `${this.botName}: Bot is online`;
    this.api.sendMessage(onlineMessage, this.ownerUid, (err) => {
      if (err) {
        logger.error(`Failed to send online message to owner: ${err.message}`);
      } else {
        logger.info(`Sent to owner: ${onlineMessage}`);
      }
    });
  }
}

module.exports = OwnerNotification;