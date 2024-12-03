const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const os = require('os');

class WhatsappController {
  constructor() {
    this.client = null;
    this.isAuthenticated = false;
    // this.sessionPath = path.join(__dirname, '../session');
    this.sessionPath = path.join(os.tmpdir(), 'whatsapp-session');
  }


  cleanupSession() {
    try {
      if (!fs.existsSync(this.sessionPath)) {
        fs.mkdirSync(this.sessionPath, { recursive: true });
        return;
      }
  
      const files = fs.readdirSync(this.sessionPath);
      files.forEach(file => {
        const filePath = path.join(this.sessionPath, file);
        
        try {
          // Use fs.rmSync with maxRetries and additional error handling
          if (fs.existsSync(filePath)) {
            fs.rmSync(filePath, { 
              recursive: true, 
              force: true, 
              maxRetries: 5,  // Increase retry attempts
              retryDelay: 2000  // Increase delay between retries
            });
          }
        } catch (fileError) {
          console.warn(`Could not remove ${filePath}:`, fileError.message);
          if (fileError.code === 'EBUSY' || fileError.code === 'EPERM') {
            console.warn('File is busy or locked. Attempting alternative cleanup.');
            
            try {
              if (this.client && this.client.pupBrowser) {
                this.client.pupBrowser.close().catch(console.error);
              }
            } catch (additionalError) {
              console.error('Additional cleanup error:', additionalError);
            }
          }
        }
      });
  
      console.log('Session cleanup completed');
    } catch (error) {
      console.error('Error during session cleanup:', error);
    }
  }


  async initializeClient() {
    try {

      if (this.client) {
        try {
          await this.client.destroy();
        } catch (destroyError) {
          console.warn('Error destroying existing client:', destroyError);
        }
      }

      this.cleanupSession();

      this.isAuthenticated = false;

      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: this.sessionPath
        }),
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
      
      // QR Code Generation Event
      this.client.on('qr', (qr) => {
        console.log('QR RECEIVED, SCAN WITH WHATSAPP');
        qrcode.generate(qr, {small: true});
      });

      // Authentication Success Event
      this.client.on('authenticated', (session) => {
        console.log('AUTHENTICATION SUCCESSFUL');
        this.isAuthenticated = true;
      });

      // Authentication Failure Event
      this.client.on('auth_failure', (msg) => {
        console.error('AUTHENTICATION FAILURE', msg);
        this.isAuthenticated = false;
        this.cleanupSession();
      });

      // Disconnection Event
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

      // Message Receive Event
      this.client.on('message', async (msg) => {
        console.log('Received Message:', {
          from: msg.from,
          body: msg.body,
          timestamp: new Date().toISOString()
        });
      });

      // Initialize the client
      await this.client.initialize();

      return { 
        success: true, 
        message: 'WhatsApp client initialized. Check console for QR code.' 
      };
    } catch (error) {
      console.error('Initialization Error:', error);
      

      try {
        if (this.client && this.client.pupBrowser) {
          await this.client.pupBrowser.close();
        }
      } catch (closeError) {
        console.error('Error closing browser during initialization failure:', closeError);
      }

      // Attempt to cleanup in case of initialization failure
      this.cleanupSession();

      return { 
        success: false, 
        error: error.message 
      };
    }
  }



 async logout() {
  try {
    if (this.client) {
      // More aggressive browser closure
      if (this.client.pupBrowser) {
        await this.client.pupBrowser.close().catch(console.error);
      }
      
      // Add timeout for destroy
      await Promise.race([
        this.client.destroy(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Destroy Timeout')), 5000))
      ]);
    }
  } catch (error) {
    console.error('Advanced Logout Handling:', error);
  } finally {
    this.cleanupSession();
  }
}

  async sendMessage(number, message) {
    try {
      // Validate authentication
      if (!this.client || !this.isAuthenticated) {
        throw new Error('WhatsApp client not authenticated');
      }

      // Send message
      await this.client.sendMessage(number, message);
      
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
    return { 
      authenticated: this.isAuthenticated 
    };
  }
}

module.exports = new WhatsappController();