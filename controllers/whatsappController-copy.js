const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

class WhatsappController {
  constructor() {
    this.client = null;
    this.isAuthenticated = false;
    this.sessionPath = path.join(__dirname, '../session');
  }


  cleanupSession() {
    try {
      // Ensure session directory exists
      if (!fs.existsSync(this.sessionPath)) {
        fs.mkdirSync(this.sessionPath, { recursive: true });
        return;
      }
  
      // Remove all files in the session directory
      const files = fs.readdirSync(this.sessionPath);
      files.forEach(file => {
        const filePath = path.join(this.sessionPath, file);
        
        try {
          // Use synchronous methods with try-catch
          if (fs.lstatSync(filePath).isDirectory()) {
            // Use recursive force remove
            fs.rmSync(filePath, { recursive: true, force: true });
          } else {
            // Use unlink with error handling
            fs.unlinkSync(filePath);
          }
        } catch (fileError) {
          console.warn(`Could not remove ${filePath}:`, fileError.message);
          
          // Additional Windows-specific handling
          if (process.platform === 'win32') {
            try {
              const { execSync } = require('child_process');
              execSync(`rd /s /q "${filePath}"`, { stdio: 'ignore' });
            } catch (cmdError) {
              console.error(`Failed to remove ${filePath} via cmd:`, cmdError);
            }
          }
        }
      });
  
      console.log('Session cleanup completed');
    } catch (error) {
      console.error('Error during session cleanup:', error);
    }
  }

  // Clean up session directory
//   cleanupSession() {
//     try {
//       // Ensure session directory exists
//       if (!fs.existsSync(this.sessionPath)) {
//         fs.mkdirSync(this.sessionPath, { recursive: true });
//         return;
//       }

//       // Remove all files in the session directory
//       const files = fs.readdirSync(this.sessionPath);
//       files.forEach(file => {
//         const filePath = path.join(this.sessionPath, file);
        
//         try {
//           // Remove file or directory
//           if (fs.lstatSync(filePath).isDirectory()) {
//             fs.rmSync(filePath, { recursive: true, force: true });
//           } else {
//             fs.unlinkSync(filePath);
//           }
//         } catch (fileError) {
//           console.warn(`Could not remove ${filePath}:`, fileError.message);
//         }
//       });

//       console.log('Session cleanup completed');
//     } catch (error) {
//       console.error('Error during session cleanup:', error);
//     }
//   }

  async initializeClient() {
    try {
      // Cleanup any existing sessions
      this.cleanupSession();

      // Create new client with fresh session
    //   this.client = new Client({
    //     authStrategy: new LocalAuth({
    //       dataPath: this.sessionPath
    //     }),
    //     puppeteer: {
    //       headless: true,
    //       args: ['--no-sandbox', '--disable-setuid-sandbox']
    //     }
    //   });

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
            '--disable-dev-shm-usage'
          ],
          executablePath: process.env.CHROME_PATH // Optional: specify Chrome path
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
      this.client.on('disconnected', (reason) => {
        console.log('Client was logged out', reason);
        this.isAuthenticated = false;
        this.cleanupSession();
      });

      // Ready Event
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
      
      // Attempt to cleanup in case of initialization failure
      this.cleanupSession();

      return { 
        success: false, 
        error: error.message 
      };
    }
  }

//   async logout() {
//     try {
//       if (this.client) {
//         await this.client.logout();
//         this.isAuthenticated = false;
//         this.cleanupSession();
//         return { 
//           success: true, 
//           message: 'Logged out successfully' 
//         };
//       }
//       return { 
//         success: false, 
//         message: 'No active client to logout' 
//       };
//     } catch (error) {
//       console.error('Logout Error:', error);
//       this.cleanupSession();
//       return { 
//         success: false, 
//         error: error.message 
//       };
//     }
//   }


async logout() {
    try {
      if (this.client) {
        // Add a timeout and force close
        await Promise.race([
          this.client.logout(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Logout timeout')), 5000)
          )
        ]);
  
        // Explicitly destroy the client
        await this.client.destroy();
        this.client = null;
        this.isAuthenticated = false;
  
        // Use recursive force remove
        this.cleanupSession();
  
        return { 
          success: true, 
          message: 'Logged out successfully' 
        };
      }
      return { 
        success: false, 
        message: 'No active client to logout' 
      };
    } catch (error) {
      console.error('Logout Error:', error);
      
      // Force cleanup even if logout fails
      try {
        // Use more aggressive cleanup
        const { execSync } = require('child_process');
        
        // Windows-specific command to kill Chrome processes
        execSync('taskkill /F /IM chrome.exe /T', { stdio: 'ignore' });
      } catch (killError) {
        console.error('Failed to kill Chrome processes:', killError);
      }
  
      this.cleanupSession();
      
      return { 
        success: false, 
        error: error.message 
      };
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