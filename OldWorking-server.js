const express = require('express');
const whatsappController = require('./controllers/whatsappController');

const app = express();
const port = 3000;

// Authentication Route
// app.get('/auth', async (req, res) => {
//   try {
//     const result = await whatsappController.initializeClient();
//     res.json(result);
//   } catch (error) {
//     res.status(500).json({ 
//       status: 'Authentication Failed', 
//       error: error.message 
//     });
//   }
// });

app.get('/auth', async (req, res) => {
    try {
      const result = await whatsappController.initializeClient();
      
      if (result.success) {
        res.json({
          status: 'Initialization Started',
          message: 'Check console for QR code. Scan to authenticate.'
        });
      } else {
        res.status(500).json({
          status: 'Initialization Failed',
          error: result.error
        });
      }
    } catch (error) {
      console.error('Auth Route Error:', error);
      res.status(500).json({ 
        status: 'Authentication Failed', 
        error: error.message 
      });
    }
  });

// Send Message Route
app.get('/send-message', async (req, res) => {
  const { number, message } = req.query;

  if (!number || !message) {
    return res.status(400).json({ 
      error: 'Number and message are required' 
    });
  }

  try {
    const result = await whatsappController.sendMessage(number, message);
    res.json(result);
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to send message' 
    });
  }
});

app.get('/logout', async (req, res) => {
    try {
      const result = await whatsappController.logout();
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        error: 'Logout failed' 
      });
    }
  });



// Authentication Status Route
app.get('/status', (req, res) => {
  res.json(whatsappController.getAuthStatus());
});




app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({
      status: 'Server Error',
      message: err.message
    });
  });
  
  // Optional: Handle uncaught exceptions and unhandled rejections
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

app.listen(port, () => {
  console.log(`WhatsApp Authentication Server running on port ${port}`);
});