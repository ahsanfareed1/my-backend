// models/ServiceProvider.js
const mongoose = require('mongoose');

const serviceProviderSchema = new mongoose.Schema({
  name: String,
  image: String,
  category: Number, // e.g. 1 for plumbing, 2 for electrical...
  rating: { type: Number, default: 0 },
  views: { type: Number, default: 0 }
});

module.exports = mongoose.model('ServiceProvider', serviceProviderSchema);
