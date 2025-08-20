const mongoose = require('mongoose');
const User = require('./models/user');
const Business = require('./models/Business');
require('dotenv').config();

async function createTestBusiness() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if test business already exists
    const existingUser = await User.findOne({ email: 'demo@business.com' });
    if (existingUser) {
      console.log('Test business account already exists');
      console.log('Email: demo@business.com');
      console.log('Password: demo123456');
      console.log('User ID:', existingUser._id);
      
      // Check if business profile exists
      const existingBusiness = await Business.findOne({ owner: existingUser._id });
      if (existingBusiness) {
        console.log('Business profile exists:', existingBusiness.businessName);
      } else {
        console.log('No business profile found, creating one...');
        
        const business = new Business({
          owner: existingUser._id,
          businessName: 'Demo Business Services',
          businessType: 'Cleaning',
          description: 'Professional cleaning services for homes and offices',
          contact: {
            phone: '+1234567890',
            email: 'demo@business.com',
            website: 'https://demo-business.com'
          },
          location: {
            address: '123 Demo Street',
            city: 'Demo City',
            area: 'Demo Area',
            coordinates: {
              lat: 40.7128,
              lng: -74.0060
            }
          },
          businessHours: {
            monday: { open: '09:00', close: '17:00', closed: false },
            tuesday: { open: '09:00', close: '17:00', closed: false },
            wednesday: { open: '09:00', close: '17:00', closed: false },
            thursday: { open: '09:00', close: '17:00', closed: false },
            friday: { open: '09:00', close: '17:00', closed: false },
            saturday: { open: '10:00', close: '15:00', closed: false },
            sunday: { open: '00:00', close: '00:00', closed: true }
          },
          status: 'active',
          verification: {
            isVerified: true
          }
        });
        
        await business.save();
        console.log('Business profile created successfully');
      }
      
      return;
    }

    // Create test business user
    const user = new User({
      firstName: 'Demo',
      lastName: 'Business',
      email: 'demo@business.com',
      password: 'demo123456',
      userType: 'business',
      isVerified: true,
      isActive: true,
      location: {
        city: 'Demo City',
        area: 'Demo Area',
        address: '123 Demo Street'
      }
    });

    await user.save();
    console.log('Test business user created:', user._id);

    // Create business profile
    const business = new Business({
      owner: user._id,
      businessName: 'Demo Business Services',
      businessType: 'Cleaning',
      description: 'Professional cleaning services for homes and offices',
      contact: {
        phone: '+1234567890',
        email: 'demo@business.com',
        website: 'https://demo-business.com'
      },
      location: {
        address: '123 Demo Street',
        city: 'Demo City',
        area: 'Demo Area',
        coordinates: {
          lat: 40.7128,
          lng: -74.0060
        }
      },
      businessHours: {
        monday: { open: '09:00', close: '17:00', closed: false },
        tuesday: { open: '09:00', close: '17:00', closed: false },
        wednesday: { open: '09:00', close: '17:00', closed: false },
        thursday: { open: '09:00', close: '17:00', closed: false },
        friday: { open: '09:00', close: '17:00', closed: false },
        saturday: { open: '10:00', close: '15:00', closed: false },
        sunday: { open: '00:00', close: '00:00', closed: true }
      },
      status: 'active',
      verification: {
        isVerified: true
      }
    });

    await business.save();
    console.log('Test business profile created successfully');

    console.log('\n=== Test Business Account Created ===');
    console.log('Email: demo@business.com');
    console.log('Password: demo123456');
    console.log('User ID:', user._id);
    console.log('Business ID:', business._id);

  } catch (error) {
    console.error('Error creating test business:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

createTestBusiness();
