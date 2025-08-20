const mongoose = require('mongoose');
const User = require('./models/user');
const Business = require('./models/Business');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/aaa-services', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function updateUserTags() {
  try {
    console.log('🔍 Starting user tag update process...');
    
    // Update existing users with tags based on their userType
    const users = await User.find({});
    console.log(`📊 Found ${users.length} users to update`);
    
    let updatedCount = 0;
    
    for (const user of users) {
      let tags = user.tags || [];
      let needsUpdate = false;
      
      // Add appropriate tag based on user type
      if (user.userType === 'customer' && !tags.includes('Customer')) {
        tags.push('Customer');
        needsUpdate = true;
      } else if (user.userType === 'business' && !tags.includes('Service Provider')) {
        tags.push('Service Provider');
        needsUpdate = true;
      } else if (user.userType === 'admin' && !tags.includes('Admin')) {
        tags.push('Admin');
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        user.tags = tags;
        await user.save();
        updatedCount++;
        console.log(`✅ Updated user: ${user.email} (${user.userType}) with tags: [${tags.join(', ')}]`);
      }
    }
    
    console.log(`\n📈 User tag update complete! Updated ${updatedCount} users.`);
    
    // Update existing businesses with Service Provider tag
    const businesses = await Business.find({});
    console.log(`\n🏢 Found ${businesses.length} businesses to update`);
    
    let businessUpdatedCount = 0;
    
    for (const business of businesses) {
      let tags = business.tags || [];
      
      if (!tags.includes('Service Provider')) {
        tags.push('Service Provider');
        business.tags = tags;
        await business.save();
        businessUpdatedCount++;
        console.log(`✅ Updated business: ${business.businessName} with tags: [${tags.join(', ')}]`);
      }
    }
    
    console.log(`\n📈 Business tag update complete! Updated ${businessUpdatedCount} businesses.`);
    
    console.log('\n🎉 All tag updates completed successfully!');
    
  } catch (error) {
    console.error('❌ Error updating user tags:', error);
  } finally {
    mongoose.connection.close();
    console.log('🔌 Database connection closed.');
  }
}

// Run the update
updateUserTags();
