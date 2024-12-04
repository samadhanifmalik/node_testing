const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class WhatsappController {
  constructor() {
    this.client = null;
    this.isAuthenticated = false;
    this.sessionPath = path.join(os.tmpdir(), 'whatsapp-session');
  }

  async cleanupSession() {
    try {
      await fs.mkdir(this.sessionPath, { recursive: true });
      const files = await fs.readdir(this.sessionPath);
      
      for (const file of files) {
        const filePath = path.join(this.sessionPath, file);
        try {
          await fs.rm(filePath, { recursive: true, force: true });
        } catch (fileError) {
          console.warn(`Could not remove ${filePath}:`, fileError.message);
          if (['EBUSY', 'EPERM'].includes(fileError.code)) {
            await this.forceCleanup();
          }
        }
      }
      console.log('Session cleanup completed');
    } catch (error) {
      console.error('Error during session cleanup:', error);
    }
  }

  async forceCleanup() {
    try {
      if (this.client?.pupBrowser) {
        await this.client.pupBrowser.close();
      }
    } catch (error) {
      console.error('Force cleanup error:', error);
    }
  }

  async initializeClient() {
    try {
      if (this.client) {
        await this.client.destroy().catch(console.warn);
      }

      await this.cleanupSession();
      this.isAuthenticated = false;

      this.client = new Client({
        authStrategy: new LocalAuth({ dataPath: this.sessionPath }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
          ],
        }
      });

      this.client.on('qr', (qr) => {
        console.log('QR RECEIVED, SCAN WITH WHATSAPP');
        qrcode.generate(qr, {small: true});
      });

      this.client.on('authenticated', (session) => {
        console.log('AUTHENTICATION SUCCESSFUL');
        this.isAuthenticated = true;
      });

      this.client.on('auth_failure', (msg) => {
        console.error('AUTHENTICATION FAILURE', msg);
        this.isAuthenticated = false;
        this.cleanupSession();
      });

      this.client.on('disconnected', async (reason) => {
        console.log(`Client disconnected. Reason: ${reason}`);
        console.log('Performing comprehensive cleanup...');
        this.isAuthenticated = false;
        // this.cleanupSession();
      });

      this.client.on('error', (err) => {
        console.error('Whatsapp Client Error:', err);
        this.cleanupSession();
        this.isAuthenticated = false;
      });

      this.client.on('ready', () => {
        console.log('CLIENT IS READY');
      });

      this.client.on('message', async (msg) => {
        console.log('Received Message:', {
          from: msg.from,
          body: msg.body,
          timestamp: new Date().toISOString()
        });
      });

      await this.client.initialize();

      return { 
        success: true, 
        message: 'WhatsApp client initialized. Check console for QR code.' 
      };
    } catch (error) {
      console.error('Initialization Error:', error);
      await this.cleanupSession();
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  async logout() {
    try {
      if (this.client?.pupBrowser) {
        await Promise.race([
          this.client.destroy(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Destroy Timeout')), 5000))
        ]);
      }
    } catch (error) {
      console.error('Logout Error:', error);
    } finally {
      await this.cleanupSession();
    }
  }

  async sendMessage(number, message) {
    try {
      if (!this.client || !this.isAuthenticated) {
        // throw new Error('WhatsApp client not authenticated');
        return { 
          success: false, 
          message: 'WhatsApp client not authenticated' 
        };
      }
      
      const numberId = await this.client.getNumberId(number);
      if (!numberId) {
        // throw new Error('Invalid WID: Number is not registered on WhatsApp');
        return { 
          success: false, 
          message: 'Invalid WID: Number is not registered on WhatsApp' 
        };
      }
      
      await this.client.sendMessage(numberId._serialized, message);
      
      return { 
        success: true, 
        message: 'Message sent successfully' 
      };
    } catch (error) {
      console.error('Error sending message:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  getAuthStatus() {
    return { authenticated: this.isAuthenticated };
  }
}

module.exports = new WhatsappController();