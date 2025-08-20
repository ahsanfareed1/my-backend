#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🚀 AAA Services Backend Setup Wizard');
console.log('=====================================\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
const envExists = fs.existsSync(envPath);

if (envExists) {
  console.log('✅ .env file already exists');
  console.log('📝 Current configuration found\n');
} else {
  console.log('❌ No .env file found');
  console.log('🔧 Let\'s create one together\n');
}

// Function to ask question
function askQuestion(question, defaultValue = '') {
  return new Promise((resolve) => {
    const prompt = defaultValue ? `${question} (${defaultValue}): ` : `${question}: `;
    rl.question(prompt, (answer) => {
      resolve(answer || defaultValue);
    });
  });
}

// Function to create .env file
async function createEnvFile() {
  try {
    console.log('📋 Please provide the following information:\n');
    
    const port = await askQuestion('Server port', '5000');
    const nodeEnv = await askQuestion('Environment (development/production)', 'development');
    
    console.log('\n🌐 MongoDB Atlas Configuration:');
    console.log('💡 You need to create a MongoDB Atlas account at https://www.mongodb.com/atlas');
    console.log('💡 Create a cluster and get your connection string\n');
    
    const mongoUri = await askQuestion('MongoDB Atlas connection string (MONGO_URI)');
    
    console.log('\n🔐 Security Configuration:');
    console.log('💡 Generate strong, random strings for these keys\n');
    
    const jwtSecret = await askQuestion('JWT Secret (at least 32 characters)');
    const sessionKey = await askQuestion('Session Secret (at least 32 characters)');
    
    const frontendUrl = await askQuestion('Frontend URL for CORS', 'http://localhost:3000');
    
    // Create .env content
    const envContent = `# Server Configuration
PORT=${port}
NODE_ENV=${nodeEnv}

# MongoDB Atlas Connection
MONGO_URI=${mongoUri}

# JWT Configuration
JWT_SECRET=${jwtSecret}
JWT_EXPIRES_IN=7d

# Session Configuration
SESSION_KEY=${sessionKey}
SESSION_MAX_AGE=86400000

# CORS Configuration
FRONTEND_URL=${frontendUrl}

# Optional: Google OAuth (if implementing social login)
# GOOGLE_CLIENT_ID=your_google_client_id
# GOOGLE_CLIENT_SECRET=your_google_client_secret

# Optional: Facebook OAuth (if implementing social login)
# FACEBOOK_APP_ID=your_facebook_app_id
# FACEBOOK_APP_SECRET=your_facebook_app_secret

# Optional: Email Configuration
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your_email@gmail.com
# SMTP_PASS=your_app_password

# Optional: SMS Configuration
# TWILIO_ACCOUNT_SID=your_twilio_account_sid
# TWILIO_AUTH_TOKEN=your_twilio_auth_token
# TWILIO_PHONE_NUMBER=your_twilio_phone_number

# Optional: Payment Configuration
# STRIPE_SECRET_KEY=your_stripe_secret_key
# STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key

# Optional: External APIs
# GOOGLE_MAPS_API_KEY=your_google_maps_api_key
# WEATHER_API_KEY=your_weather_api_key
`;

    // Write .env file
    fs.writeFileSync(envPath, envContent);
    console.log('\n✅ .env file created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating .env file:', error.message);
  }
}

// Function to validate configuration
function validateConfiguration() {
  try {
    require('dotenv').config();
    
    const required = ['MONGO_URI', 'JWT_SECRET', 'SESSION_KEY'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.log('❌ Missing required environment variables:', missing.join(', '));
      return false;
    }
    
    console.log('✅ All required environment variables are set');
    return true;
    
  } catch (error) {
    console.error('❌ Error validating configuration:', error.message);
    return false;
  }
}

// Function to test database connection
async function testDatabaseConnection() {
  try {
    console.log('\n🔌 Testing database connection...');
    
    const mongoose = require('mongoose');
    const connectDB = require('./config/db');
    
    await connectDB();
    console.log('✅ Database connection successful!');
    
    // Close connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    
    return true;
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('\n💡 Please check your MongoDB Atlas configuration:');
    console.log('   - Ensure your cluster is running');
    console.log('   - Verify your connection string');
    console.log('   - Check network access settings');
    console.log('   - Verify username and password');
    return false;
  }
}

// Function to install dependencies
async function installDependencies() {
  try {
    console.log('\n📦 Checking dependencies...');
    
    const packageJson = require('./package.json');
    const missingDeps = [];
    
    // Check for required dependencies
    const required = ['express', 'mongoose', 'jsonwebtoken', 'bcryptjs', 'cors'];
    required.forEach(dep => {
      if (!packageJson.dependencies[dep]) {
        missingDeps.push(dep);
      }
    });
    
    if (missingDeps.length > 0) {
      console.log(`❌ Missing dependencies: ${missingDeps.join(', ')}`);
      console.log('📦 Installing missing dependencies...');
      
      const { execSync } = require('child_process');
      execSync('npm install', { stdio: 'inherit' });
      
      console.log('✅ Dependencies installed successfully!');
    } else {
      console.log('✅ All dependencies are installed');
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error installing dependencies:', error.message);
    return false;
  }
}

// Main setup function
async function runSetup() {
  try {
    // Install dependencies first
    await installDependencies();
    
    // Create .env file if it doesn't exist
    if (!envExists) {
      await createEnvFile();
    }
    
    // Validate configuration
    if (!validateConfiguration()) {
      console.log('\n❌ Configuration validation failed');
      console.log('💡 Please fix the issues and run setup again');
      rl.close();
      return;
    }
    
    // Test database connection
    const dbConnected = await testDatabaseConnection();
    
    if (dbConnected) {
      console.log('\n🎉 Setup completed successfully!');
      console.log('\n🚀 You can now start the server:');
      console.log('   npm run dev    # Development mode');
      console.log('   npm start      # Production mode');
      console.log('\n🧪 Test the API:');
      console.log('   npm test       # Run test suite');
      console.log('\n📚 Check the README.md for API documentation');
    } else {
      console.log('\n❌ Setup completed with database connection issues');
      console.log('💡 Please fix the database connection and try again');
    }
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  } finally {
    rl.close();
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  runSetup();
}

module.exports = {
  createEnvFile,
  validateConfiguration,
  testDatabaseConnection,
  installDependencies
};

