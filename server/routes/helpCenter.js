const express = require('express');
const router = express.Router();
const { sendHelpCenterContactEmail, sendHelpCenterConfirmationEmail } = require('../services/emailService');

// help center contact form submit krne k liye
router.post('/contact', async (req, res) => {
  try {
    const { name, email, subject, message, category } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message || !category) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Prepare contact data
    const contactData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim(),
      category: category
    };

    // Send email to admin
    await sendHelpCenterContactEmail(contactData);

    // Send confirmation email to user
    await sendHelpCenterConfirmationEmail(contactData);

    

    res.status(200).json({
      success: true,
      message: 'Your message has been sent successfully. We\'ll get back to you within a few hours.'
    });

  } catch (error) {
    console.error('Error processing help center contact form:', error);
    
    res.status(500).json({
      success: false,
      message: 'Sorry, there was an error sending your message. Please try again or contact us directly.'
    });
  }
});

module.exports = router;
