const express = require('express');
const passport = require('passport');
const User = require('../models/user');
const Business = require('../models/Business');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Return only safe fields
const sanitizeUser = (user) => ({
  _id: user._id,
  id: user._id,
  username: user.username,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  phone: user.phone,
  location: user.location,
  userType: user.userType,
  isVerified: user.isVerified,
  isActive: user.isActive,
  profilePicture: user.profilePicture,
  createdAt: user.createdAt,
  lastLogin: user.lastLogin,
  tags: user.tags || []
});

// Input validation middleware
const validateRegistrationInput = (req, res, next) => {
  const { firstName, lastName, email, password, confirmPassword, location } = req.body;
  
  const errors = [];
  
  if (!firstName || firstName.trim().length < 2) {
    errors.push('First name must be at least 2 characters long');
  }
  
  if (!lastName || lastName.trim().length < 2) {
    errors.push('Last name must be at least 2 characters long');
  }
  
  if (!email || !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
    errors.push('Please provide a valid email address');
  }
  
  if (!password || password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }

  if (password !== confirmPassword) {
    errors.push('Passwords do not match');
  }
  
  if (!location || !location.city) {
    errors.push('City is required in location information');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      message: 'Validation failed',
      errors
    });
  }
  
  next();
};

const validateLoginInput = (req, res, next) => {
  const { email, password } = req.body;
  
  const errors = [];
  
  if (!email) {
    errors.push('Email is required');
  }
  
  if (!password) {
    errors.push('Password is required');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      message: 'Validation failed',
      errors
    });
  }
  
  next();
};

// ==================== Register ====================
router.post('/register', validateRegistrationInput, async (req, res) => {
  const { username, firstName, lastName, email, password, confirmPassword, location, phone, userType = 'customer' } = req.body;

  try {
    // Check if email already exists
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      return res.status(400).json({ 
        message: 'Registration failed',
        error: 'Email already registered. Please use a different email or try logging in.' 
      });
    }

    // Check if username exists (only if provided)
    if (username) {
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        return res.status(400).json({ 
          message: 'Registration failed',
          error: 'Username already taken. Please choose a different username.' 
        });
      }
    }

    // Validate user type
    const validUserTypes = ['customer', 'business', 'admin'];
    if (!validUserTypes.includes(userType)) {
      return res.status(400).json({
        message: 'Registration failed',
        error: `Invalid user type. Must be one of: ${validUserTypes.join(', ')}`
      });
    }

    // Create new user
    const newUser = new User({
      username, // This can be undefined, the model will generate one
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      password,
      location: {
        city: location.city.trim(),
        area: location.area ? location.area.trim() : undefined,
        address: location.address ? location.address.trim() : undefined,
        coordinates: location.coordinates || undefined
      },
      phone: phone ? phone.trim() : undefined,
      userType: userType || 'customer', // Ensure customer is default
      tags: ['Customer'] // Explicitly set Customer tag
    });

    await newUser.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Return success with token
    return res.status(201).json({ 
      message: 'Registration successful! Welcome to AAA Services.',
      user: sanitizeUser(newUser),
      token,
      nextSteps: userType === 'business' ? [
        'Complete your business profile',
        'Upload business documents for verification',
        'Set your service areas and business hours'
      ] : [
        'Complete your profile',
        'Browse available services',
        'Book appointments with verified businesses'
      ]
    });

  } catch (err) {
    console.error('Registration error:', err);
    
    if (err.name === 'ValidationError') {
      const validationErrors = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: validationErrors 
      });
    }
    
    return res.status(500).json({ 
      message: 'Registration failed',
      error: 'Server error during registration. Please try again.' 
    });
  }
});

// ==================== Business Registration ====================
router.post('/business/register', validateRegistrationInput, async (req, res) => {
  const { 
    firstName, lastName, email, password, confirmPassword, location, phone,
    businessName, businessType, description, businessContact, businessLocation, services,
    images, businessHours
  } = req.body;

  try {
    // Check if email already exists
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      return res.status(400).json({ 
        message: 'Registration failed',
        error: 'Email already registered. Please use a different email or try logging in.' 
      });
    }

    // Validate business information
    if (!businessName || businessName.trim().length < 2) {
      return res.status(400).json({
        message: 'Business registration failed',
        error: 'Business name must be at least 2 characters long'
      });
    }

    if (!businessType) {
      return res.status(400).json({
        message: 'Business registration failed',
        error: 'Business type is required'
      });
    }

    if (!description || description.trim().length < 20) {
      return res.status(400).json({
        message: 'Business registration failed',
        error: 'Business description must be at least 20 characters long'
      });
    }

    // Create new user with business type
    const newUser = new User({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      password,
      location: {
        city: location.city.trim(),
        area: location.area ? location.area.trim() : undefined,
        address: location.address ? location.address.trim() : undefined,
        coordinates: location.coordinates || undefined
      },
      phone: phone ? phone.trim() : undefined,
      userType: 'business',
      profilePicture: images?.logo || undefined,
      tags: ['Service Provider'] // Explicitly set Service Provider tag
    });

    await newUser.save();

    // Create business profile with more flexible validation
    const businessData = {
      owner: newUser._id,
      businessName: businessName.trim(),
      businessType,
      description: description.trim(),
      contact: {
        phone: businessContact?.phone || phone || '',
        email: businessContact?.email || email,
        website: businessContact?.website || undefined
      },
      location: {
        address: businessLocation?.address || location.address || '',
        city: businessLocation?.city || location.city,
        area: businessLocation?.area || location.area,
        coordinates: {
          lat: businessLocation?.coordinates?.lat || location.coordinates?.lat || 0,
          lng: businessLocation?.coordinates?.lng || location.coordinates?.lng || 0
        },
        serviceAreas: businessLocation?.serviceAreas || [location.city]
      },
      services: services || [],
      images: {
        logo: images?.logo || undefined,
        cover: images?.cover || undefined,
        gallery: images?.gallery || []
      },
      businessHours: businessHours || undefined,
      status: 'pending', // New businesses start as pending for admin review
      tags: ['Service Provider'] // Explicitly set Service Provider tag
    };

    // Only add coordinates if they exist and are valid
    if (businessData.location.coordinates.lat === 0 && businessData.location.coordinates.lng === 0) {
      delete businessData.location.coordinates;
    }

    const business = new Business(businessData);
    await business.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Return success with token
    return res.status(201).json({ 
      message: 'Thank you for registering your business with us! Your application is in process of verification. We will email you once it\'s active or if we need any further verification.',
      user: sanitizeUser(newUser),
      business: {
        id: business._id,
        businessName: business.businessName,
        status: business.status
      },
      token,
      nextSteps: [
        'Complete your business profile with detailed information',
        'Upload business images and verification documents',
        'Set your business hours and service areas',
        'Wait for admin verification (usually within 24-48 hours)'
      ]
    });

  } catch (err) {
    console.error('Business registration error:', err);
    
    if (err.name === 'ValidationError') {
      const validationErrors = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: validationErrors 
      });
    }
    
    return res.status(500).json({ 
      message: 'Business registration failed',
      error: 'Server error during registration. Please try again.' 
    });
  }
});

// ==================== Customer Login ====================
router.post('/login', validateLoginInput, async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ 
        message: 'Login failed',
        error: 'Invalid email or password. Please check your credentials and try again.' 
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ 
        message: 'Login failed',
        error: 'Account is deactivated. Please contact support for assistance.' 
      });
    }

    // Check if user is trying to login as customer but has business account
    if (user.userType === 'business') {
      return res.status(403).json({ 
        message: 'Access Denied',
        error: 'You have a business account. Please login through the business login portal.',
        redirectTo: '/business-login',
        userType: 'business'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: 'Login failed',
        error: 'Invalid email or password. Please check your credentials and try again.' 
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Return success with token
    return res.status(200).json({ 
      message: 'Login successful! Welcome back.',
      user: sanitizeUser(user),
      token,
      welcomeMessage: 'Welcome back! Ready to find great services?'
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ 
      message: 'Login failed',
      error: 'Server error during login. Please try again.' 
    });
  }
});

// ==================== Business Login ====================
router.post('/business/login', validateLoginInput, async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ 
        message: 'Business login failed',
        error: 'Invalid email or password. Please check your credentials and try again.' 
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ 
        message: 'Business login failed',
        error: 'Account is deactivated. Please contact support for assistance.' 
      });
    }

    // Check if user is trying to login as business but has customer account
    if (user.userType === 'customer') {
      return res.status(403).json({ 
        message: 'Access Denied',
        error: 'You have a customer account. Please login through the customer login portal.',
        redirectTo: '/login',
        userType: 'customer'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: 'Business login failed',
        error: 'Invalid email or password. Please check your credentials and try again.' 
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // Get business info
    let businessInfo = null;
    if (user.userType === 'business') {
      const business = await Business.findOne({ owner: user._id })
        .select('businessName status verification.isVerified');
      if (business) {
        businessInfo = {
          id: business._id,
          businessName: business.businessName,
          status: business.status,
          isVerified: business.verification.isVerified
        };
      }
    }

    // Return success with token
    return res.status(200).json({ 
      message: 'Business login successful! Welcome back.',
      user: sanitizeUser(user),
      business: businessInfo,
      token,
      welcomeMessage: 'Welcome back to your business dashboard!'
    });

  } catch (err) {
    console.error('Business login error:', err);
    return res.status(500).json({ 
      message: 'Business login failed',
      error: 'Server error during login. Please try again.' 
    });
  }
});

// ==================== Logout ====================
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ 
      message: 'Logout failed',
      error: 'Error during logout process' 
    });
    res.status(200).json({ 
      message: 'Logged out successfully',
      note: 'Your session has been terminated. Please login again to continue.' 
    });
  });
});

// ==================== Get Current User ====================
router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ 
    message: 'Authentication required',
    error: 'Please login to access this resource' 
  });

  return res.status(200).json({ 
    user: sanitizeUser(req.user),
    message: 'User profile retrieved successfully'
  });
});

// ==================== Refresh Token ====================
router.post('/refresh', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        message: 'Token refresh failed',
        error: 'Refresh token is required'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        message: 'Token refresh failed',
        error: 'User not found or account inactive'
      });
    }

    // Generate new token
    const newToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Token refreshed successfully',
      user: sanitizeUser(user),
      token: newToken
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        message: 'Token refresh failed',
        error: 'Invalid refresh token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Token refresh failed',
        error: 'Refresh token has expired. Please login again.'
      });
    }

    res.status(500).json({
      message: 'Token refresh failed',
      error: 'Server error during token refresh'
    });
  }
});

module.exports = router;
