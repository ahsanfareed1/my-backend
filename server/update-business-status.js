const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/aaa-services', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const Business = require('./models/Business');

async function updateBusinessStatus() {
  try {
    console.log('🔍 Starting business status update...');
    
    // Find all businesses that don't have a status field or have status 'active'
    const businessesToUpdate = await Business.find({
      $or: [
        { status: { $exists: false } },
        { status: 'active' }
      ]
    });
    
    console.log(`🔍 Found ${businessesToUpdate.length} businesses to update`);
    
    if (businessesToUpdate.length === 0) {
      console.log('✅ All businesses already have correct status');
      return;
    }
    
    // Update all businesses to 'pending' status
    const updateResult = await Business.updateMany(
      {
        $or: [
          { status: { $exists: false } },
          { status: 'active' }
        ]
      },
      {
        $set: {
          status: 'pending',
          statusUpdatedAt: new Date()
        }
      }
    );
    
    console.log(`✅ Updated ${updateResult.modifiedCount} businesses to pending status`);
    
    // Verify the update
    const pendingBusinesses = await Business.find({ status: 'pending' });
    const activeBusinesses = await Business.find({ status: 'active' });
    
    console.log(`📊 Status summary:`);
    console.log(`   - Pending: ${pendingBusinesses.length}`);
    console.log(`   - Active: ${activeBusinesses.length}`);
    
    console.log('✅ Business status update completed successfully!');
    
  } catch (error) {
    console.error('❌ Error updating business status:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the update
updateBusinessStatus();
