const { Client, LocalAuth } = require('whatsapp-web.js');

const createWhatsappClient = () => {
  return new Client({
    authStrategy: new LocalAuth({
      dataPath: './session'
    }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });
};

module.exports = { createWhatsappClient };