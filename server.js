const express = require('express');
const whatsappController = require('./controllers/whatsappController');

const app = express();
require('dotenv').config();

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Route Handlers
const handleAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Authentication Route
app.get('/auth', handleAsync(async (req, res) => {
  const result = await whatsappController.initializeClient();
  
  res.status(result.success ? 200 : 500).json({
    status: result.success ? 'Initialization Started' : 'Initialization Failed',
    ...(result.success 
      ? { message: 'Check console for QR code. Scan to authenticate.' }
      : { error: result.error }
    )
  });
}));

// Send Message Route
app.get('/send-message', handleAsync(async (req, res) => {
  const { number, message } = req.query;

  if (!number || !message) {
    return res.status(400).json({ 
      error: 'Number and message are required' 
    });
  }

  const result = await whatsappController.sendMessage(number, message);
  res.status(result.success ? 200 : 500).json(result);
}));


app.get('/get-mess', (req, res) => {
    // res.json(whatsappController.getContacts());
    whatsappController.getContacts(req, res);
  });

  app.get('/get-senders-today', (req, res) => {
    whatsappController.getSendersForToday(req, res);
});

app.get('/get-todays-messages', (req, res) => {
    whatsappController.getTodaysMessagesByContact(req, res);
});


// Logout Route
app.get('/logout', handleAsync(async (req, res) => {
  await whatsappController.logout();
  res.json({ success: true, message: 'Logged out successfully' });
}));

// Authentication Status Route
app.get('/status', (req, res) => {
  res.json(whatsappController.getAuthStatus());
});

app.listen(PORT, () => {
  console.log(`WhatsApp Authentication Server running on PORT: ${PORT}`);
});