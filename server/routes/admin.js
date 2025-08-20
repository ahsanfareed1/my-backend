const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Business = require('../models/Business');
const Review = require('../models/Review');
const User = require('../models/user');

// Middleware to verify admin token
const authenticateAdmin = async (req, res, next) => {
  try {
    console.log('🔍 Backend: authenticateAdmin middleware - Request headers:', req.headers);
    
    const token = req.header('Authorization')?.replace('Bearer ', '');
    console.log('🔍 Backend: Token extracted:', token ? 'Present' : 'Missing');
    
    if (!token) {
      console.log('🔍 Backend: No token provided');
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    console.log('🔍 Backend: Token decoded:', { adminId: decoded.adminId, username: decoded.username });
    
    const admin = await Admin.findById(decoded.adminId);
    console.log('🔍 Backend: Admin found:', admin ? { id: admin._id, username: admin.username, isActive: admin.isActive } : 'Not found');
    
    if (!admin || !admin.isActive) {
      console.log('🔍 Backend: Admin not found or inactive');
      return res.status(401).json({ message: 'Access denied. Invalid token.' });
    }

    req.admin = admin;
    console.log('🔍 Backend: Admin authenticated successfully:', admin.username);
    next();
  } catch (error) {
    console.error('🔍 Backend: Authentication error:', error);
    res.status(401).json({ message: 'Invalid token.' });
  }
};

// Test endpoint to verify admin routes are working
router.get('/test', (req, res) => {
  res.json({ message: 'Admin routes are working!', timestamp: new Date().toISOString() });
});

// Admin login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const admin = await Admin.findOne({ username: username.toLowerCase() });
    
    if (!admin || !admin.isActive) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isPasswordValid = await admin.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Generate JWT token
    const token = jwt.sign(
      { adminId: admin._id, username: admin.username, role: admin.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        fullName: admin.fullName,
        role: admin.role,
        permissions: admin.permissions
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get admin dashboard stats
router.get('/dashboard-stats', authenticateAdmin, async (req, res) => {
  try {
    const totalBusinesses = await Business.countDocuments();
    const pendingBusinesses = await Business.countDocuments({ status: 'pending' });
    const activeBusinesses = await Business.countDocuments({ status: 'active' });
    const totalReviews = await Review.countDocuments();
    const totalUsers = await User.countDocuments();
    const totalComplaints = await Review.countDocuments({ status: 'flagged' });

    res.json({
      totalBusinesses,
      pendingBusinesses,
      activeBusinesses,
      totalReviews,
      totalUsers,
      totalComplaints
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all service providers (businesses)
router.get('/service-providers', authenticateAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    
    let query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { businessName: { $regex: search, $options: 'i' } },
        { 'contact.email': { $regex: search, $options: 'i' } },
        { 'location.city': { $regex: search, $options: 'i' } }
      ];
    }

    const businesses = await Business.find(query)
      .populate('owner', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Business.countDocuments(query);

    res.json({
      businesses,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get service providers error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update business status
router.patch('/service-providers/:id/status', authenticateAdmin, async (req, res) => {
  try {
    console.log('🔍 Backend: PATCH /service-providers/:id/status - Request received');
    console.log('🔍 Backend: Request params:', req.params);
    console.log('🔍 Backend: Request body:', req.body);
    console.log('🔍 Backend: Admin user:', req.admin._id);
    
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!['active', 'pending', 'suspended', 'rejected', 'inactive'].includes(status)) {
      console.log('🔍 Backend: Invalid status:', status);
      return res.status(400).json({ message: 'Invalid status' });
    }

    console.log('🔍 Backend: Updating business:', id, 'to status:', status);
    
    const business = await Business.findByIdAndUpdate(
      id,
      { 
        status,
        statusReason: reason,
        statusUpdatedAt: new Date(),
        statusUpdatedBy: req.admin._id
      },
      { new: true }
    );

    if (!business) {
      console.log('🔍 Backend: Business not found:', id);
      return res.status(404).json({ message: 'Business not found' });
    }

    console.log('🔍 Backend: Business status updated successfully:', business._id, '->', business.status);
    res.json({ message: 'Status updated successfully', business });
  } catch (error) {
    console.error('🔍 Backend: Update business status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete business
router.delete('/service-providers/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const business = await Business.findByIdAndDelete(id);
    
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    // Also delete associated reviews
    await Review.deleteMany({ business: id });

    res.json({ message: 'Business deleted successfully' });
  } catch (error) {
    console.error('Delete business error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all reviews
router.get('/reviews', authenticateAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    
    let query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { comment: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } }
      ];
    }

    const reviews = await Review.find(query)
      .populate('reviewer', 'firstName lastName email')
      .populate('business', 'businessName businessType')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Review.countDocuments(query);

    res.json({
      reviews,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update review status
router.patch('/reviews/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!['active', 'hidden', 'flagged', 'deleted'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const review = await Review.findByIdAndUpdate(
      id,
      { 
        status,
        adminNotes: reason,
        statusUpdatedAt: new Date(),
        statusUpdatedBy: req.admin._id
      },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    res.json({ message: 'Review status updated successfully', review });
  } catch (error) {
    console.error('Update review status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get complaints
router.get('/complaints', authenticateAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    let query = { status: 'flagged' };
    
    if (status && status !== 'all') {
      query.status = status;
    }

    const complaints = await Review.find(query)
      .populate('reviewer', 'firstName lastName email')
      .populate('business', 'businessName businessType')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Review.countDocuments(query);

    res.json({
      complaints,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get complaints error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get admin profile
router.get('/profile', authenticateAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id).select('-password');
    res.json(admin);
  } catch (error) {
    console.error('Get admin profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Logout (client-side token removal)
router.post('/logout', authenticateAdmin, async (req, res) => {
  try {
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
