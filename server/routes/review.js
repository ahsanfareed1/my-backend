const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Business = require('../models/Business');
const User = require('../models/user');



// Health check endpoint to test database connectivity
router.get('/health', async (req, res) => {
  try {
    // Test database connection by counting reviews
    const totalReviews = await Review.countDocuments({});
    const totalBusinesses = await Business.countDocuments({});
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        reviews: totalReviews,
        businesses: totalBusinesses
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

// POST /api/reviews - Add review for business
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      businessId,
      rating,
      title,
      comment,
      serviceType,
      serviceDate,
      serviceCost,
      serviceQuality,
      communication,
      valueForMoney,
      punctuality,
      professionalism,
      images
    } = req.body;

    // Validate business exists
    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({
        message: 'Business not found'
      });
    }

    // Check if business is active
    if (business.status !== 'active') {
      return res.status(400).json({
        message: 'Cannot review inactive business'
      });
    }

    // Check if user has already reviewed this business
    const existingReview = await Review.findOne({
      reviewer: req.user._id,
      business: businessId
    });

    if (existingReview) {
      return res.status(400).json({
        message: 'You have already reviewed this business'
      });
    }

    // Create new review
    const review = new Review({
      reviewer: req.user._id,
      business: businessId,
      rating,
      title,
      comment,
      serviceType,
      serviceDate,
      serviceCost,
      serviceQuality,
      communication,
      valueForMoney,
      punctuality,
      professionalism,
      images
    });

    await review.save();

    // Populate review with user and business info
    await review.populate('reviewer', 'firstName lastName profilePicture');
    await review.populate('business', 'businessName businessType images.logo');

    

    res.status(201).json({
      message: 'Review added successfully',
      review
    });

  } catch (error) {
    console.error('Add review error:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    res.status(500).json({
      message: 'Server error while adding review',
      error: error.message
    });
  }
});

// GET /api/reviews - Get all reviews with filters
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      businessId,
      reviewerId,
      rating,
      serviceType,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;
    let query = { status: 'active' };

    // Apply filters
    if (businessId) query.business = businessId;
    if (reviewerId) query.reviewer = reviewerId;
    if (rating) query.rating = parseInt(rating);
    if (serviceType) query.serviceType = serviceType;

    

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const reviews = await Review.find(query)
      .populate('reviewer', 'firstName lastName profilePicture')
      .populate('business', 'businessName businessType images.logo')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    

    // Get total count for pagination
    const total = await Review.countDocuments(query);

    res.json({
      reviews,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalReviews: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({
      message: 'Server error while fetching reviews',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// GET /api/reviews/recent - Get recent reviews for Recent Activities
router.get('/recent', async (req, res) => {
  try {
    const { limit = 6 } = req.query;

    const reviews = await Review.find({ status: 'active' })
      .populate('reviewer', 'firstName lastName profilePicture')
      .populate('business', 'businessName businessType images.logo location.city')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    // Format the response for Recent Activities
    const formattedReviews = reviews.map(review => ({
      id: review._id,
      reviewer: {
        name: `${review.reviewer?.firstName || ''} ${review.reviewer?.lastName || ''}`.trim(),
        avatar: review.reviewer?.profilePicture || null,
        id: review.reviewer?._id
      },
      business: {
        name: review.business?.businessName || 'Unknown Business',
        type: review.business?.businessType || 'other',
        city: review.business?.location?.city || 'Unknown City',
        logo: review.business?.images?.logo || null,
        id: review.business?._id
      },
      rating: review.rating,
      title: review.title || '',
      comment: review.comment,
      serviceType: review.serviceType,
      createdAt: review.createdAt,
      serviceDate: review.serviceDate
    }));

    res.json({
      success: true,
      reviews: formattedReviews,
      total: formattedReviews.length
    });

  } catch (error) {
    console.error('Recent reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent reviews',
      error: error.message
    });
  }
});

// GET /api/reviews/:id - Get single review
router.get('/:id', async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate('reviewer', 'firstName lastName profilePicture')
      .populate('business', 'businessName businessType images.logo');

    if (!review) {
      return res.status(404).json({
        message: 'Review not found'
      });
    }

    if (review.status !== 'active') {
      return res.status(404).json({
        message: 'Review not available'
      });
    }

    res.json({
      review
    });

  } catch (error) {
    console.error('Get review by ID error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        message: 'Invalid review ID'
      });
    }

    res.status(500).json({
      message: 'Server error while fetching review',
      error: error.message
    });
  }
});

// PUT /api/reviews/:id - Update review
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        message: 'Review not found'
      });
    }

    // Check if user owns this review
    if (review.reviewer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Access denied. You can only update your own reviews.'
      });
    }

    const updateData = req.body;
    
    // Remove fields that shouldn't be updated
    delete updateData.reviewer;
    delete updateData.business;
    delete updateData.isVerified;
    delete updateData.status;

    const updatedReview = await Review.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('reviewer', 'firstName lastName profilePicture')
      .populate('business', 'businessName businessType images.logo');

    res.json({
      message: 'Review updated successfully',
      review: updatedReview
    });

  } catch (error) {
    console.error('Update review error:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    res.status(500).json({
      message: 'Server error while updating review',
      error: error.message
    });
  }
});

// DELETE /api/reviews/:id - Delete review
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        message: 'Review not found'
      });
    }

    // Check if user owns this review
    if (review.reviewer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: 'Access denied. You can only delete your own reviews.'
      });
    }

    // Soft delete - mark as deleted
    review.status = 'deleted';
    await review.save();

    res.json({
      message: 'Review deleted successfully'
    });

  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({
      message: 'Server error while deleting review',
      error: error.message
    });
  }
});

// GET /api/reviews/business/:businessId - Get reviews for specific business
router.get('/business/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const { page = 1, limit = 10, rating, serviceType, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const skip = (page - 1) * limit;

    // Validate business exists and is active
    const business = await Business.findById(businessId);
    if (!business) {
      return res.status(404).json({
        message: 'Business not found'
      });
    }
    
    // Check if business is active (only active businesses can have reviews displayed)
    if (business.status !== 'active') {
      return res.status(404).json({
        message: 'Business not found or not active'
      });
    }

    let query = { business: businessId, status: 'active' };
    
    if (rating) query.rating = parseInt(rating);
    if (serviceType) query.serviceType = serviceType;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const reviews = await Review.find(query)
      .populate('reviewer', 'firstName lastName profilePicture')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments(query);

    res.json({
      reviews,
      business: {
        id: business._id,
        name: business.businessName,
        type: business.businessType,
        averageRating: business.rating.average,
        totalReviews: business.rating.totalReviews
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalReviews: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get business reviews error:', error);
    res.status(500).json({
      message: 'Server error while fetching business reviews',
      error: error.message
    });
  }
});

// GET /api/reviews/user/:userId - Get reviews by specific user
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    const query = { reviewer: userId, status: 'active' };

    const reviews = await Review.find(query)
      .populate('business', 'businessName businessType images.logo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments(query);

    res.json({
      reviews,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePicture: user.profilePicture
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalReviews: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get user reviews error:', error);
    res.status(500).json({
      message: 'Server error while fetching user reviews',
      error: error.message
    });
  }
});

// POST /api/reviews/:id/helpful - Mark review as helpful
router.post('/:id/helpful', authenticateToken, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        message: 'Review not found'
      });
    }

    await review.markHelpful(req.user._id);

    res.json({
      message: 'Review marked as helpful',
      helpfulCount: review.isHelpful.helpful
    });

  } catch (error) {
    console.error('Mark helpful error:', error);
    res.status(500).json({
      message: 'Server error while marking review as helpful',
      error: error.message
    });
  }
});

// POST /api/reviews/:id/not-helpful - Mark review as not helpful
router.post('/:id/not-helpful', authenticateToken, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        message: 'Review not found'
      });
    }

    await review.markNotHelpful(req.user._id);

    res.json({
      message: 'Review marked as not helpful',
      helpfulCount: review.isHelpful.helpful,
      notHelpfulCount: review.isHelpful.notHelpful
    });

  } catch (error) {
    console.error('Mark not helpful error:', error);
    res.status(500).json({
      message: 'Server error while marking review as not helpful',
      error: error.message
    });
  }
});

// POST /api/reviews/:id/flag - Flag inappropriate review
router.post('/:id/flag', authenticateToken, async (req, res) => {
  try {
    const { reason, description } = req.body;

    if (!reason) {
      return res.status(400).json({
        message: 'Flag reason is required'
      });
    }

    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        message: 'Review not found'
      });
    }

    await review.flagReview(req.user._id, reason, description);

    res.json({
      message: 'Review flagged successfully'
    });

  } catch (error) {
    console.error('Flag review error:', error);
    res.status(500).json({
      message: 'Server error while flagging review',
      error: error.message
    });
  }
});

// GET /api/reviews/featured/top - Get top reviews
router.get('/featured/top', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const reviews = await Review.findTopReviews(parseInt(limit));

    res.json({
      reviews
    });

  } catch (error) {
    console.error('Get top reviews error:', error);
    res.status(500).json({
      message: 'Server error while fetching top reviews',
      error: error.message
    });
  }
});

module.exports = router;
