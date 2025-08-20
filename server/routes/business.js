const express = require('express');
const router = express.Router();
const Business = require('../models/Business');
const User = require('../models/user');

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        message: 'Access token required',
        error: 'Please provide a valid authentication token in the Authorization header'
      });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        message: 'Invalid token',
        error: 'User not found for the provided token'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ 
        message: 'Account deactivated',
        error: 'Your account has been deactivated. Please contact support.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ 
        message: 'Invalid token',
        error: 'The provided token is not valid'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ 
        message: 'Token expired',
        error: 'Your session has expired. Please login again.'
      });
    }
    return res.status(403).json({ 
      message: 'Token verification failed',
      error: 'Unable to verify your authentication token'
    });
  }
};

// Input validation middleware
const validateBusinessInput = (req, res, next) => {
  const { businessName, businessType, description, contact, location } = req.body;
  
  const errors = [];
  
  if (!businessName || businessName.trim().length < 2) {
    errors.push('Business name must be at least 2 characters long');
  }
  
  if (!businessType) {
    errors.push('Business type is required');
  }
  
  if (!description || description.trim().length < 20) {
    errors.push('Description must be at least 20 characters long');
  }
  
  if (!contact || !contact.phone || !contact.email) {
    errors.push('Phone and email are required in contact information');
  }
  
  if (!location || !location.address || !location.city) {
    errors.push('Address and city are required in location information');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      message: 'Validation failed',
      errors
    });
  }
  
  next();
};

// POST /api/business - Add new business
router.post('/', authenticateToken, validateBusinessInput, async (req, res) => {
  try {
    const {
      businessName,
      businessType,
      description,
      contact,
      location,
      services,
      businessHours,
      images,
      tags
    } = req.body;

    // Check if user already has a business
    const existingBusiness = await Business.findOne({ owner: req.user._id });
    if (existingBusiness) {
      return res.status(400).json({
        message: 'You already have a registered business',
        error: 'Each user can only register one business. Please update your existing business instead.',
        existingBusinessId: existingBusiness._id
      });
    }

    // Validate business type
    const validBusinessTypes = [
      'plumbing', 'electrical', 'cleaning', 'painting', 'gardening',
      'repair', 'transport', 'security', 'education', 'food',
      'beauty', 'health', 'construction', 'maintenance', 'other'
    ];
    
    if (!validBusinessTypes.includes(businessType)) {
      return res.status(400).json({
        message: 'Invalid business type',
        error: `Business type must be one of: ${validBusinessTypes.join(', ')}`
      });
    }

    // Create new business
    const business = new Business({
      owner: req.user._id,
      businessName: businessName.trim(),
      businessType,
      description: description.trim(),
      contact: {
        phone: contact.phone.trim(),
        email: contact.email.trim().toLowerCase(),
        website: contact.website ? contact.website.trim() : undefined
      },
      location: {
        address: location.address.trim(),
        city: location.city.trim(),
        area: location.area ? location.area.trim() : undefined,
        coordinates: location.coordinates || { lat: 0, lng: 0 },
        serviceAreas: location.serviceAreas || []
      },
      services: services || [],
      businessHours: businessHours || {},
      images: images || {},
      tags: tags ? tags.map(tag => tag.trim()) : [],
      status: 'pending' // New businesses start as pending for admin review
    });

    await business.save();

    // Update user type to business
    await User.findByIdAndUpdate(req.user._id, { 
      userType: 'business',
      phone: contact.phone // Update user phone if not set
    });

    // Populate owner details for response
    await business.populate('owner', 'firstName lastName email profilePicture');

    res.status(201).json({
      message: 'Thank you for registering your business with us! Your business will be activated soon when we verify it. You may receive a call or email for more verification if we require.',
      business,
      nextSteps: [
        'Complete your business profile with detailed information',
        'Upload business images and documents',
        'Set your business hours and service areas',
        'Wait for admin verification (usually within 24-48 hours)'
      ]
    });

  } catch (error) {
    console.error('Business registration error:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    res.status(500).json({
      message: 'Server error during business registration',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// GET /api/business - Fetch all businesses (real-time for frontend)
router.get('/', async (req, res) => {
  try {
    console.log('🔍 Backend: GET /api/business - Request received');
    console.log('🔍 Backend: GET /api/business - Query params:', req.query);
    
    const {
      page = 1,
      limit = 10,
      businessType,
      city,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      isVerified,
      minRating,
      status = 'active'
    } = req.query;

    const skip = (page - 1) * limit;
    let query = { status };

    console.log('🔍 Backend: GET /api/business - Initial query:', query);

    // Apply filters
    if (businessType) query.businessType = businessType;
    if (city) query['location.city'] = { $regex: city, $options: 'i' };
    if (isVerified !== undefined) query['verification.isVerified'] = isVerified === 'true';
    if (minRating) query['rating.average'] = { $gte: parseFloat(minRating) };

    // Apply search
    if (search) {
      query.$or = [
        { businessName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
        { 'location.city': { $regex: search, $options: 'i' } }
      ];
    }

    console.log('🔍 Backend: GET /api/business - Final query:', query);

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    console.log('🔍 Backend: GET /api/business - Executing query...');

    // Execute query
    const businesses = await Business.find(query)
      .populate('owner', 'firstName lastName email profilePicture')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-verification.documents -__v');

    console.log('🔍 Backend: GET /api/business - Found businesses:', businesses.length);

    // Get total count for pagination
    const total = await Business.countDocuments(query);

    console.log('🔍 Backend: GET /api/business - Total businesses in database:', total);

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page * limit < total;
    const hasPrevPage = page > 1;

    const response = {
      businesses,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalBusinesses: total,
        hasNextPage,
        hasPrevPage,
        limit: parseInt(limit)
      },
      filters: {
        businessType,
        city,
        search,
        isVerified,
        minRating,
        status
      }
    };

    console.log('🔍 Backend: GET /api/business - Sending response');
    res.json(response);

  } catch (error) {
    console.error('🔍 Backend: Get businesses error:', error);
    console.error('🔍 Backend: Error stack:', error.stack);
    res.status(500).json({
      message: 'Server error while fetching businesses',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// GET /api/business/:id - Fetch single business details
router.get('/:id', async (req, res) => {
  try {
    const business = await Business.findById(req.params.id)
      .populate('owner', 'firstName lastName email profilePicture phone')
      .populate('verification.verifiedBy', 'firstName lastName');

    if (!business) {
      return res.status(404).json({
        message: 'Business not found',
        error: 'The requested business does not exist'
      });
    }

    // If not active, allow owner to view when authenticated
    if (business.status !== 'active') {
      try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (token) {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
          if (decoded?.userId && String(business.owner?._id) === String(decoded.userId)) {
            return res.json({ business, note: `Owner view: business is ${business.status}` });
          }
        }
      } catch (e) {
        // ignore token errors and fall through to 404
      }
      return res.status(404).json({
        message: 'Business not available',
        error: `This business is currently ${business.status}`
      });
    }

    res.json({ business });

  } catch (error) {
    console.error('Get business by ID error:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({
        message: 'Invalid business ID',
        error: 'The provided business ID is not in the correct format'
      });
    }
    res.status(500).json({
      message: 'Server error while fetching business',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// PUT /api/business/:id - Update business
router.put('/:id', authenticateToken, validateBusinessInput, async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({
        message: 'Business not found',
        error: 'The requested business does not exist'
      });
    }

    // Check if user owns this business
    if (business.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Access denied',
        error: 'You can only update your own business'
      });
    }

    const updateData = req.body;
    
    // Remove fields that shouldn't be updated directly
    delete updateData.owner;
    delete updateData.verification;
    delete updateData.rating;

    // Allow owners to activate their business (but not set arbitrary statuses)
    if (updateData.status && updateData.status !== 'active') {
      delete updateData.status;
    }
    delete updateData.createdAt;
    delete updateData.updatedAt;

    // Clean and validate update data
    if (updateData.businessName) updateData.businessName = updateData.businessName.trim();
    if (updateData.description) updateData.description = updateData.description.trim();
    if (updateData.contact) {
      if (updateData.contact.phone) updateData.contact.phone = updateData.contact.phone.trim();
      if (updateData.contact.email) updateData.contact.email = updateData.contact.email.toLowerCase().trim();
      if (updateData.contact.website) updateData.contact.website = updateData.contact.website.trim();
    }
    if (updateData.location) {
      if (updateData.location.address) updateData.location.address = updateData.location.address.trim();
      if (updateData.location.city) updateData.location.city = updateData.location.city.trim();
      if (updateData.location.area) updateData.location.area = updateData.location.area.trim();
    }
    if (updateData.tags) {
      updateData.tags = updateData.tags.map(tag => tag.trim()).filter(tag => tag.length > 0);
    }

    const updatedBusiness = await Business.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('owner', 'firstName lastName email profilePicture');

    res.json({
      message: 'Business updated successfully',
      business: updatedBusiness
    });

  } catch (error) {
    console.error('Update business error:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    res.status(500).json({
      message: 'Server error while updating business',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// DELETE /api/business/:id - Delete business
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({
        message: 'Business not found',
        error: 'The requested business does not exist'
      });
    }

    // Check if user owns this business
    if (business.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Access denied',
        error: 'You can only delete your own business'
      });
    }

    // Soft delete - mark as inactive
    business.status = 'inactive';
    await business.save();

    // Update user type back to customer
    await User.findByIdAndUpdate(req.user._id, { userType: 'customer' });

    res.json({
      message: 'Business deleted successfully',
      note: 'Your business has been deactivated. You can reactivate it anytime by updating the status.'
    });

  } catch (error) {
    console.error('Delete business error:', error);
    res.status(500).json({
      message: 'Server error while deleting business',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// GET /api/business/owner/my-business - Get user's own business
router.get('/owner/my-business', authenticateToken, async (req, res) => {
  try {
    const business = await Business.findOne({ owner: req.user._id })
      .populate('owner', 'firstName lastName email profilePicture');

    if (!business) {
      return res.status(404).json({
        message: 'No business found for this user',
        error: 'You have not registered a business yet',
        nextSteps: [
          'Register your business using POST /api/business',
          'Provide business details, contact information, and location',
          'Upload business images and set service areas'
        ]
      });
    }

    res.json({
      business
    });

  } catch (error) {
    console.error('Get my business error:', error);
    res.status(500).json({
      message: 'Server error while fetching business',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// GET /api/business/type/:businessType - Get businesses by type
router.get('/type/:businessType', async (req, res) => {
  try {
    const { businessType } = req.params;
    const { page = 1, limit = 10, city, status = 'active' } = req.query;
    const skip = (page - 1) * limit;

    let query = { businessType, status };
    if (city) query['location.city'] = { $regex: city, $options: 'i' };

    const businesses = await Business.find(query)
      .populate('owner', 'firstName lastName email profilePicture')
      .sort({ 'rating.average': -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-verification.documents -__v');

    const total = await Business.countDocuments(query);

    res.json({
      businesses,
      businessType,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalBusinesses: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get businesses by type error:', error);
    res.status(500).json({
      message: 'Server error while fetching businesses by type',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// GET /api/business/location/:city - Get businesses by location
router.get('/location/:city', async (req, res) => {
  try {
    const { city } = req.params;
    const { page = 1, limit = 10, businessType, status = 'active' } = req.query;
    const skip = (page - 1) * limit;

    let query = { 'location.city': { $regex: city, $options: 'i' }, status };
    if (businessType) query.businessType = businessType;

    const businesses = await Business.find(query)
      .populate('owner', 'firstName lastName email profilePicture')
      .sort({ 'rating.average': -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-verification.documents -__v');

    const total = await Business.countDocuments(query);

    res.json({
      businesses,
      city,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalBusinesses: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get businesses by location error:', error);
    res.status(500).json({
      message: 'Server error while fetching businesses by location',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// GET /api/business/featured/verified - Get verified businesses
router.get('/featured/verified', async (req, res) => {
  try {
    const { limit = 10, city } = req.query;

    let query = {
      'verification.isVerified': true,
      status: 'active'
    };
    
    if (city) query['location.city'] = { $regex: city, $options: 'i' };

    const businesses = await Business.find(query)
      .populate('owner', 'firstName lastName email profilePicture')
      .sort({ 'rating.average': -1, 'rating.totalReviews': -1 })
      .limit(parseInt(limit))
      .select('-verification.documents -__v');

    res.json({
      businesses,
      total: businesses.length,
      note: 'These are verified businesses with high ratings'
    });

  } catch (error) {
    console.error('Get verified businesses error:', error);
    res.status(500).json({
      message: 'Server error while fetching verified businesses',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// PATCH /api/business/:id/status - Update business status (for admin use)
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.userType !== 'admin') {
      return res.status(403).json({
        message: 'Access denied',
        error: 'Only administrators can update business status'
      });
    }

    const { status, verificationNote } = req.body;
    const validStatuses = ['active', 'inactive', 'suspended', 'pending'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: 'Invalid status',
        error: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }

    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({
        message: 'Business not found',
        error: 'The requested business does not exist'
      });
    }

    business.status = status;
    
    if (status === 'active' && !business.verification.isVerified) {
      business.verification.isVerified = true;
      business.verification.verifiedAt = new Date();
      business.verification.verifiedBy = req.user._id;
    }

    await business.save();

    res.json({
      message: `Business status updated to ${status}`,
      business: {
        id: business._id,
        businessName: business.businessName,
        status: business.status,
        verification: business.verification
      }
    });

  } catch (error) {
    console.error('Update business status error:', error);
    res.status(500).json({
      message: 'Server error while updating business status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

module.exports = router;
