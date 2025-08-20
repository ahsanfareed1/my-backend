// Configuration Example File
// Copy this file to config.js and fill in your actual values
// Or create a .env file with the same variables

module.exports = {
  // Server Configuration
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // MongoDB Atlas Configuration
  mongoUri: process.env.MONGO_URI || 'mongodb+srv://username:password@cluster.mongodb.net/aaa_services?retryWrites=true&w=majority',
  
  // JWT Configuration
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-here-make-it-long-and-random',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  
  // Session Configuration
  sessionKey: process.env.SESSION_KEY || 'your-session-secret-key-here',
  sessionMaxAge: process.env.SESSION_MAX_AGE || 1000 * 60 * 60 * 24, // 1 day
  
  // CORS Configuration
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  
  // Rate Limiting
  rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // 15 minutes
  rateLimitMax: process.env.RATE_LIMIT_MAX || 100, // requests per window
  
  // Security
  helmetEnabled: process.env.HELMET_ENABLED !== 'false',
  corsEnabled: process.env.CORS_ENABLED !== 'false',
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  enableRequestLogging: process.env.ENABLE_REQUEST_LOGGING !== 'false',
  
  // Business Configuration
  businessVerificationRequired: process.env.BUSINESS_VERIFICATION_REQUIRED !== 'false',
  maxBusinessImages: process.env.MAX_BUSINESS_IMAGES || 10,
  maxServiceAreas: process.env.MAX_SERVICE_AREAS || 20,
  
  // File Upload
  maxFileSize: process.env.MAX_FILE_SIZE || '10mb',
  allowedImageTypes: process.env.ALLOWED_IMAGE_TYPES || ['image/jpeg', 'image/png', 'image/webp'],
  
  // Email (for future use)
  smtpHost: process.env.SMTP_HOST,
  smtpPort: process.env.SMTP_PORT || 587,
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  
  // SMS (for future use)
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,
  
  // Payment (for future use)
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  
  // External APIs
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
  weatherApiKey: process.env.WEATHER_API_KEY
};

// Example .env file content:
/*
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Atlas Connection
MONGO_URI=mongodb+srv://your_username:your_password@your_cluster.mongodb.net/aaa_services?retryWrites=true&w=majority

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random_at_least_32_characters

# Session Configuration
SESSION_KEY=your_session_secret_key_here_also_make_it_long_and_random

# CORS Configuration
FRONTEND_URL=http://localhost:3000

# Optional: Google OAuth (if implementing social login)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Optional: Facebook OAuth (if implementing social login)
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret

# Optional: Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Optional: SMS Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# Optional: Payment Configuration
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key

# Optional: External APIs
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
WEATHER_API_KEY=your_weather_api_key
*/

