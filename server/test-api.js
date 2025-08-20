const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

// Test data
const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'password123',
  firstName: 'Test',
  lastName: 'User',
  phone: '+923001234567',
  location: {
    city: 'Lahore',
    area: 'Township',
    address: '123 Test Street'
  }
};

const testBusiness = {
  businessName: 'Test Plumbing Services',
  businessType: 'plumbing',
  description: 'Professional plumbing services for residential and commercial properties. We offer 24/7 emergency services with guaranteed quality workmanship.',
  contact: {
    phone: '+923001234567',
    email: 'test@plumbing.com',
    website: 'https://testplumbing.com'
  },
  location: {
    address: '456 Business Avenue',
    city: 'Lahore',
    area: 'Township',
    coordinates: {
      lat: 31.5204,
      lng: 74.3587
    },
    serviceAreas: ['Lahore', 'Islamabad', 'Rawalpindi']
  },
  services: [
    {
      name: 'Pipe Repair',
      description: 'Fix leaking and broken pipes',
      price: 1500,
      priceType: 'fixed'
    },
    {
      name: 'Drain Cleaning',
      description: 'Professional drain cleaning services',
      price: 2000,
      priceType: 'fixed'
    }
  ],
  tags: ['plumbing', 'emergency', '24/7', 'professional']
};

const testReview = {
  businessId: '', // Will be filled after business creation
  rating: 5,
  title: 'Excellent Service',
  comment: 'Very professional and punctual. Fixed our plumbing issue quickly and efficiently. Highly recommended!',
  serviceType: 'plumbing',
  serviceDate: new Date(),
  serviceCost: 1500,
  serviceQuality: 5,
  communication: 5,
  valueForMoney: 5,
  punctuality: 5,
  professionalism: 5
};

let authToken = '';

// Test functions
async function testServerHealth() {
  try {
    console.log('🏥 Testing server health...');
    const response = await axios.get(`${BASE_URL}/`);
    console.log('✅ Server health check passed:', response.data.message);
    return true;
  } catch (error) {
    console.error('❌ Server health check failed:', error.message);
    return false;
  }
}

async function testAPIStatus() {
  try {
    console.log('📊 Testing API status...');
    const response = await axios.get(`${BASE_URL}/api/status`);
    console.log('✅ API status check passed:', response.data.message);
    console.log('📊 Database status:', response.data.database);
    return true;
  } catch (error) {
    console.error('❌ API status check failed:', error.message);
    return false;
  }
}

async function testUserRegistration() {
  try {
    console.log('👤 Testing user registration...');
    const response = await axios.post(`${BASE_URL}/api/users/register`, testUser);
    console.log('✅ User registration passed:', response.data.message);
    authToken = response.data.token;
    return response.data.user._id;
  } catch (error) {
    console.error('❌ User registration failed:', error.response?.data?.message || error.message);
    return null;
  }
}

async function testUserLogin() {
  try {
    console.log('🔐 Testing user login...');
    const response = await axios.post(`${BASE_URL}/api/users/login`, {
      email: testUser.email,
      password: testUser.password
    });
    console.log('✅ User login passed:', response.data.message);
    authToken = response.data.token;
    return response.data.user._id;
  } catch (error) {
    console.error('❌ User login failed:', error.response?.data?.message || error.message);
    return null;
  }
}

async function testBusinessCreation() {
  try {
    console.log('🏢 Testing business creation...');
    const response = await axios.post(`${BASE_URL}/api/business`, testBusiness, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    console.log('✅ Business creation passed:', response.data.message);
    testReview.businessId = response.data.business._id;
    return response.data.business._id;
  } catch (error) {
    console.error('❌ Business creation failed:', error.response?.data?.message || error.message);
    return null;
  }
}

async function testGetAllBusinesses() {
  try {
    console.log('📋 Testing get all businesses...');
    const response = await axios.get(`${BASE_URL}/api/business`);
    console.log('✅ Get all businesses passed:', response.data.businesses.length, 'businesses found');
    return true;
  } catch (error) {
    console.error('❌ Get all businesses failed:', error.response?.data?.message || error.message);
    return false;
  }
}

async function testGetBusinessById(businessId) {
  try {
    console.log('🔍 Testing get business by ID...');
    const response = await axios.get(`${BASE_URL}/api/business/${businessId}`);
    console.log('✅ Get business by ID passed:', response.data.business.businessName);
    return true;
  } catch (error) {
    console.error('❌ Get business by ID failed:', error.response?.data?.message || error.message);
    return false;
  }
}

async function testReviewCreation() {
  try {
    console.log('⭐ Testing review creation...');
    const response = await axios.post(`${BASE_URL}/api/reviews`, testReview, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    console.log('✅ Review creation passed:', response.data.message);
    return response.data.review._id;
  } catch (error) {
    console.error('❌ Review creation failed:', error.response?.data?.message || error.message);
    return null;
  }
}

async function testGetAllReviews() {
  try {
    console.log('📝 Testing get all reviews...');
    const response = await axios.get(`${BASE_URL}/api/reviews`);
    console.log('✅ Get all reviews passed:', response.data.reviews.length, 'reviews found');
    return true;
  } catch (error) {
    console.error('❌ Get all reviews failed:', error.response?.data?.message || error.message);
    return false;
  }
}

async function testGetBusinessReviews(businessId) {
  try {
    console.log('🏢 Testing get business reviews...');
    const response = await axios.get(`${BASE_URL}/api/reviews/business/${businessId}`);
    console.log('✅ Get business reviews passed:', response.data.reviews.length, 'reviews found');
    return true;
  } catch (error) {
    console.error('❌ Get business reviews failed:', error.response?.data?.message || error.message);
    return false;
  }
}

async function testUserProfile() {
  try {
    console.log('👤 Testing get user profile...');
    const response = await axios.get(`${BASE_URL}/api/users/profile`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    console.log('✅ Get user profile passed:', response.data.user.firstName, response.data.user.lastName);
    return true;
  } catch (error) {
    console.error('❌ Get user profile failed:', error.response?.data?.message || error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting API Tests...\n');
  
  // Test server health
  const serverHealthy = await testServerHealth();
  if (!serverHealthy) {
    console.log('❌ Server is not running. Please start the server first.');
    return;
  }
  
  // Test API status
  await testAPIStatus();
  
  // Test user operations
  let userId = await testUserRegistration();
  if (!userId) {
    userId = await testUserLogin();
  }
  
  if (userId) {
    await testUserProfile();
    
    // Test business operations
    const businessId = await testBusinessCreation();
    if (businessId) {
      await testGetAllBusinesses();
      await testGetBusinessById(businessId);
      
      // Test review operations
      const reviewId = await testReviewCreation();
      if (reviewId) {
        await testGetAllReviews();
        await testGetBusinessReviews(businessId);
      }
    }
  }
  
  console.log('\n🎉 API Tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  testUser,
  testBusiness,
  testReview
};
