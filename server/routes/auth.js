const express = require('express');
const passport = require('passport');
const mongoose = require('mongoose');
const User = require('../models/user');
const Business = require('../models/Business');
const jwt = require('jsonwebtoken');
const { sendPasswordResetEmail, sendWelcomeEmail, sendEmailVerificationEmail } = require('../services/emailService');

const router = express.Router();

// returning only safe user fields
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

// registration input validate krne k liye
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

// Customer Register Function
router.post('/register', validateRegistrationInput, async (req, res) => {
  const { username, firstName, lastName, email, password, confirmPassword, location, phone, userType = 'customer' } = req.body;

  try {
    // its actually checking if email already exists -
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      return res.status(400).json({ 
        message: 'Registration failed',
        error: 'Email already registered. Please use a different email or try logging in.' 
      });
    }

    // its checking if username exists (only if provided)
    if (username) {
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        return res.status(400).json({ 
          message: 'Registration failed',
          error: 'Username already taken. Please choose a different username.' 
        });
      }
    }

    // checking user type
    const validUserTypes = ['customer', 'business', 'admin'];
    if (!validUserTypes.includes(userType)) {
      return res.status(400).json({
        message: 'Registration failed',
        error: `Invalid user type. Must be one of: ${validUserTypes.join(', ')}`
      });
    }

    // creating new user
    const newUser = new User({
      username,
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
      userType: userType || 'customer', 
      tags: ['Customer'] 
    });

    await newUser.save();

    // send welcome email to customer
    try {
      await sendWelcomeEmail(email, firstName);
    } catch (emailError) {
      console.error('Welcome email failed to send:', emailError);
    }

    // create jwt token
    const token = jwt.sign(
      { userId: newUser._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );
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

// business register request handle krne k liye
router.post('/business/register', validateRegistrationInput, async (req, res) => {
  const { 
    firstName, lastName, email, password, confirmPassword, location, phone,
    businessName, businessType, description, businessContact, businessLocation, services,
    additionalServices, images, businessHours
  } = req.body;

  try {
    // its checking if email already exists
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      return res.status(400).json({ 
        message: 'Registration failed',
        error: 'Email already registered. Please use a different email or try logging in.' 
      });
    }

    //  its checking business information
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

    // its creating user and business without transaction (for standalone MongoDB)
    let newUser, business;
    
    try {
      // making new user with business type
      newUser = new User({
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
        tags: ['Service Provider'] 
      });

      await newUser.save();

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
        additionalServices: additionalServices || [],
        images: {
          logo: images?.logo || undefined,
          cover: images?.cover || []
        },
        businessHours: businessHours || undefined,
        status: 'active',
        tags: ['Service Provider'] 
      };

      // only adding coordinates if they exist and are valid
      if (businessData.location.coordinates.lat === 0 && businessData.location.coordinates.lng === 0) {
        delete businessData.location.coordinates;
      }

      business = new Business(businessData);
      await business.save();

      
      
    } catch (businessError) {
      console.error('Business save error:', businessError);
      
      // if business creation failed, try to clean up the user
      if (newUser && newUser._id) {
        try {
          await User.findByIdAndDelete(newUser._id);
          
        } catch (cleanupError) {
          console.error('Failed to cleanup user:', cleanupError);
        }
      }
      
      if (businessError.name === 'ValidationError') {
        
        
        // returning specific validation errors
        const validationErrors = Object.values(businessError.errors).map(err => err.message);
        return res.status(400).json({
          message: 'Business registration failed',
          error: validationErrors.join(', ')
        });
      }
      throw businessError;
    }

    // making email verification token
    const verificationToken = newUser.generateEmailVerificationToken();
    await newUser.save();

    // making verification URL
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;

    // sending email verification email (dont fail if email fails)
    try {
      await sendEmailVerificationEmail(email, verificationUrl, firstName, 'business');
    } catch (emailError) {
      console.error('Verification email failed to send:', emailError);
      // dont fail registration for email issues
    }

    // making jwt token
    const token = jwt.sign(
      { userId: newUser._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // returning success with token
    
    
    return res.status(201).json({ 
      message: 'Thank you for registering your business with us! Please check your email to verify your account before you can login.',
      note: 'Your business is now active and visible to customers.',
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
        'Your business is now live and visible to customers!'
      ]
    });

  } catch (err) {
    console.error('Business registration error:', err);
    
    if (err.name === 'ValidationError') {
      const validationErrors = Object.values(err.errors).map(error => error.message);
      console.error('Validation errors:', validationErrors);
      return res.status(400).json({ 
        message: 'Business registration failed', 
        error: validationErrors.join(', ')
      });
    }
    
    // checking if it's a duplicate key error (email already exists)
    if (err.code === 11000) {
      return res.status(400).json({
        message: 'Business registration failed',
        error: 'Email already registered. Please use a different email or try logging in.'
      });
    }
    
    return res.status(500).json({ 
      message: 'Business registration failed',
      error: `Server error: ${err.message}` 
    });
  }
});

// ==================== Customer Login ====================
router.post('/login', validateLoginInput, async (req, res) => {
  const { email, password } = req.body;

  try {
    // finding user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ 
        message: 'Login failed',
        error: 'Invalid email or password. Please check your credentials and try again.' 
      });
    }

    // checking if user is active
    if (!user.isActive) {
      return res.status(401).json({ 
        message: 'Login failed',
        error: 'Account is deactivated. Please contact support for assistance.' 
      });
    }

    // checking if user is trying to login as customer but has business account
    if (user.userType === 'business') {
      return res.status(403).json({ 
        message: 'Access Denied',
        error: 'You have a business account. Please login through the business login portal.',
        redirectTo: '/business-login',
        userType: 'business'
      });
    }

    // checking password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: 'Login failed',
        error: 'Invalid email or password. Please check your credentials and try again.' 
      });
    }

    // updating last login
    user.lastLogin = new Date();
    await user.save();

    // making jwt token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // returning success with token
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
    // finding user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ 
        message: 'Business login failed',
        error: 'Invalid email or password. Please check your credentials and try again.' 
      });
    }

    // checking if user is active
    if (!user.isActive) {
      return res.status(401).json({ 
        message: 'Business login failed',
        error: 'Account is deactivated. Please contact support for assistance.' 
      });
    }

    // checking if email is verified
    if (!user.emailVerified) {
      return res.status(401).json({ 
        message: 'Email verification required',
        error: 'Please verify your email address before logging in. Check your email for the verification link.',
        needsVerification: true
      });
    }

    // checking if user is trying to login as business but has customer account
    if (user.userType === 'customer') {
      return res.status(403).json({ 
        message: 'Access Denied',
        error: 'You have a customer account. Please login through the customer login portal.',
        redirectTo: '/login',
        userType: 'customer'
      });
    }

    // checking password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({ 
        message: 'Business login failed',
        error: 'Invalid email or password. Please check your credentials and try again.' 
      });
    }

    // updating last login
    user.lastLogin = new Date();
    await user.save();

    // making jwt token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    // getting business info
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

    // returning success with token
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

// ==================== Forgot Password ====================
router.post('/forgot-password', async (req, res) => {
  const { email, userType } = req.body;

  try {
    // Validate email
    if (!email || !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
      return res.status(400).json({
        message: 'Invalid email format',
        error: 'Please provide a valid email address'
      });
    }

    // Validate userType if provided
    if (userType && !['customer', 'business'].includes(userType)) {
      return res.status(400).json({
        message: 'Invalid user type',
        error: 'User type must be either "customer" or "business"'
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.status(200).json({
        message: 'If an account with that email exists, a password reset link has been sent.',
        note: 'Check your email for further instructions.'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(400).json({
        message: 'Account is deactivated',
        error: 'Please contact support for assistance.'
      });
    }

    // Validate user type if specified
    if (userType && user.userType !== userType) {
      return res.status(400).json({
        message: 'Invalid email for this account type',
        error: `This email is registered as a ${user.userType} account, not a ${userType} account. Please use the correct email address.`
      });
    }

    // Generate reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save();

    // Create reset URL
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    // Send password reset email
    try {
      await sendPasswordResetEmail(email, resetUrl, user.firstName, user.userType);
      
      // Send success response with user type info
      const responseMessage = user.userType === 'business' 
        ? 'Password reset link has been sent to your business email.'
        : 'Password reset link has been sent to your email.';
      
      const responseNote = user.userType === 'business'
        ? 'Please check your business email and follow the instructions to reset your password.'
        : 'Please check your email and follow the instructions to reset your password.';
      
      res.status(200).json({
        message: responseMessage,
        note: responseNote,
        userType: user.userType,
        resetUrl: process.env.NODE_ENV === 'development' ? resetUrl : undefined
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      
      // Clear the reset token since email failed
      user.clearPasswordResetToken();
      await user.save();
      
      res.status(500).json({
        message: 'Failed to send password reset email',
        error: 'Please try again later or contact support for assistance.'
      });
    }

  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({
      message: 'Failed to process password reset request',
      error: 'Server error. Please try again later.'
    });
  }
});

// ==================== Reset Password ====================
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  try {
    // Validate input
    if (!token) {
      return res.status(400).json({
        message: 'Reset token is required',
        error: 'Please provide a valid reset token'
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        message: 'Invalid password',
        error: 'Password must be at least 6 characters long'
      });
    }

    // Find user with valid reset token
    const user = await User.findOne({
      resetToken: { $exists: true },
      resetTokenExpiry: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        message: 'Invalid or expired reset token',
        error: 'Please request a new password reset link'
      });
    }

    // Verify the token
    if (!user.isResetTokenValid(token)) {
      return res.status(400).json({
        message: 'Invalid reset token',
        error: 'Please request a new password reset link'
      });
    }

    // Update password
    user.password = password;
    user.clearPasswordResetToken();
    await user.save();

    res.status(200).json({
      message: 'Password has been reset successfully',
      note: 'You can now login with your new password'
    });

  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({
      message: 'Failed to reset password',
      error: 'Server error. Please try again later.'
    });
  }
});

// =======Verify Reset Token ========
router.get('/verify-reset-token/:token', async (req, res) => {
  const { token } = req.params;

  try {
    // Find user with valid reset token
    const user = await User.findOne({
      resetToken: { $exists: true },
      resetTokenExpiry: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        message: 'Invalid or expired reset token',
        error: 'Please request a new password reset link'
      });
    }

    // Verify the token
    if (!user.isResetTokenValid(token)) {
      return res.status(400).json({
        message: 'Invalid reset token',
        error: 'Please request a new password reset link'
      });
    }

    res.status(200).json({
      message: 'Reset token is valid',
      note: 'You can proceed to reset your password'
    });

  } catch (err) {
    console.error('Verify reset token error:', err);
    res.status(500).json({
      message: 'Failed to verify reset token',
      error: 'Server error. Please try again later.'
    });
  }
});

// email verify krne k liye
router.get('/verify-email/:token', async (req, res) => {
  const { token } = req.params;
  
  // Also check query parameter for compatibility
  const tokenFromQuery = req.query.token;
  const finalToken = token || tokenFromQuery;
  
  try {
    // First, try to find user by token in all users (including already verified ones)
    const allUsers = await User.find({
      emailVerificationToken: { $exists: true }
    });

    // Find the user with the matching token
    let user = null;
    for (const potentialUser of allUsers) {
      // Check if token matches (even if expired for already verified users)
      if (potentialUser.emailVerificationToken) {
        const crypto = require('crypto');
        const hashedToken = crypto
          .createHash('sha256')
          .update(finalToken)
          .digest('hex');
        
        if (potentialUser.emailVerificationToken === hashedToken) {
          user = potentialUser;
          break;
        }
      }
    }

    if (!user) {
      // agr user na mile to helpful message return krdo
      return res.status(200).json({
        success: true,
        alreadyVerified: true,
        message: 'Your email appears to be already verified. You can login directly.',
        note: 'If you continue to have issues, please contact support.'
      });
    }

    // Check if user is already verified
    if (user.emailVerified) {
      return res.status(200).json({
        success: true,
        alreadyVerified: true,
        message: 'Your email is already verified. You can login normally.',
        userType: user.userType,
        userEmail: user.email
      });
    }

    // Mark email as verified
    user.verifyEmail();
    await user.save();

    

    res.status(200).json({
      success: true,
      message: 'Email verified successfully!',
      note: 'Your account is now verified. You can login and access all features.',
      userType: user.userType,
      userEmail: user.email
    });

  } catch (err) {
    console.error('Email verification error:', err);
    res.status(500).json({
      message: 'Failed to verify email',
      error: 'Server error. Please try again later.'
    });
  }
});

// ===Get User Info from Token ===========
router.get('/verify-email-info/:token', async (req, res) => {
  const { token } = req.params;
  
  try {
    // Find user with the specific email verification token
    const users = await User.find({
      emailVerificationToken: { $exists: true },
      emailVerificationExpiry: { $gt: Date.now() }
    });

    // Find the user with the matching token
    let user = null;
    for (const potentialUser of users) {
      if (potentialUser.isEmailVerificationTokenValid(token)) {
        user = potentialUser;
        break;
      }
    }

    if (!user) {
      return res.status(400).json({
        message: 'Invalid or expired verification token',
        error: 'Please request a new verification link'
      });
    }

    res.status(200).json({
      userEmail: user.email,
      userType: user.userType,
      firstName: user.firstName
    });

  } catch (err) {
    console.error('Get user info error:', err);
    res.status(500).json({
      message: 'Failed to get user info',
      error: 'Server error. Please try again later.'
    });
  }
});

// ==================== Resend Email Verification ====================
router.post('/resend-verification', async (req, res) => {
  const { email, userType } = req.body;

  try {
    // Validate email
    if (!email || !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
      return res.status(400).json({
        message: 'Invalid email format',
        error: 'Please provide a valid email address'
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    
    if (!user) {
      return res.status(200).json({
        message: 'If an account with that email exists, a verification link has been sent.',
        note: 'Check your email for further instructions.'
      });
    }

    // Check if user is already verified
    if (user.emailVerified) {
      return res.status(400).json({
        message: 'Email already verified',
        error: 'Your email is already verified. You can login normally.',
        alreadyVerified: true
      });
    }

    // Check if user type matches
    if (userType && user.userType !== userType) {
      return res.status(400).json({
        message: 'Invalid email for this account type',
        error: `This email is registered as a ${user.userType} account, not a ${userType} account.`
      });
    }

    // Generate new verification token
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();

    // Create verification URL
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;

    // Send verification email
    try {
      await sendEmailVerificationEmail(email, verificationUrl, user.firstName, user.userType);
      
      res.status(200).json({
        message: 'Verification email sent successfully',
        note: 'Please check your email and click the verification link.',
        userType: user.userType,
        verificationUrl: process.env.NODE_ENV === 'development' ? verificationUrl : undefined
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      
      // Clear the verification token since email failed
      user.clearEmailVerificationToken();
      await user.save();
      
      res.status(500).json({
        message: 'Failed to send verification email',
        error: 'Please try again later or contact support for assistance.'
      });
    }

  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({
      message: 'Failed to resend verification email',
      error: 'Server error. Please try again later.'
    });
  }
});

module.exports = router;
