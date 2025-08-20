# AAA Services Backend Server

A robust Node.js backend server for the AAA Services platform, providing business registration, user management, and service listing functionality with MongoDB Atlas integration.

## 🚀 Features

- **User Authentication & Authorization**
  - JWT-based authentication
  - User registration and login
  - Business owner registration
  - Role-based access control

- **Business Management**
  - Business registration and profile management
  - Service listing and management
  - Business verification system
  - Location-based business search

- **Security Features**
  - Password hashing with bcrypt
  - Rate limiting
  - Helmet security headers
  - Input validation and sanitization
  - CORS protection

- **Database**
  - MongoDB Atlas integration
  - Mongoose ODM with validation
  - Connection pooling and optimization
  - Graceful error handling

## 📋 Prerequisites

- Node.js (v16 or higher)
- MongoDB Atlas account
- npm or yarn package manager

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Back-End/server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create environment configuration**
   Create a `.env` file in the server directory with the following variables:
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   
   # MongoDB Atlas Connection
   MONGO_URI=mongodb+srv://your_username:your_password@your_cluster.mongodb.net/aaa_services?retryWrites=true&w=majority
   
   # JWT Configuration
   JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random
   
   # Session Configuration
   SESSION_KEY=your_session_secret_key_here
   
   # CORS Configuration
   FRONTEND_URL=http://localhost:3000
   ```

4. **Start the server**
   ```bash
   # Development mode with auto-reload
   npm run dev
   
   # Production mode
   npm start
   ```

## 🗄️ Database Setup

### MongoDB Atlas Configuration

1. **Create MongoDB Atlas Cluster**
   - Sign up at [MongoDB Atlas](https://www.mongodb.com/atlas)
   - Create a new cluster (M0 Free tier recommended for development)
   - Set up database access with username and password
   - Configure network access (allow your IP or 0.0.0.0/0 for development)

2. **Get Connection String**
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<username>`, `<password>`, and `<dbname>` with your values

3. **Database Collections**
   The server will automatically create the following collections:
   - `users` - User accounts and profiles
   - `businesses` - Business listings and profiles
   - `reviews` - Customer reviews and ratings
   - `sessions` - User session data

## 📚 API Endpoints

### Authentication

#### User Registration
```http
POST /api/auth/register
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "password123",
  "confirmPassword": "password123",
  "location": {
    "city": "Lahore",
    "area": "Township",
    "address": "123 Main Street"
  },
  "phone": "+923001234567"
}
```

#### Business Registration
```http
POST /api/auth/business/register
Content-Type: application/json

{
  "firstName": "Jane",
  "lastName": "Smith",
  "email": "jane@business.com",
  "password": "password123",
  "confirmPassword": "password123",
  "location": {
    "city": "Lahore",
    "area": "Township"
  },
  "phone": "+923001234567",
  "businessName": "Smith Plumbing Services",
  "businessType": "plumbing",
  "description": "Professional plumbing services for residential and commercial properties",
  "businessContact": {
    "phone": "+923001234567",
    "email": "contact@smithplumbing.com"
  },
  "businessLocation": {
    "address": "456 Business Avenue",
    "city": "Lahore",
    "area": "Township"
  }
}
```

#### User Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

### Business Management

#### Create Business Profile
```http
POST /api/business
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "businessName": "ABC Services",
  "businessType": "cleaning",
  "description": "Professional cleaning services for homes and offices",
  "contact": {
    "phone": "+923001234567",
    "email": "contact@abcservices.com",
    "website": "https://abcservices.com"
  },
  "location": {
    "address": "789 Service Street",
    "city": "Lahore",
    "area": "Township",
    "coordinates": {
      "lat": 31.5204,
      "lng": 74.3587
    },
    "serviceAreas": ["Lahore", "Islamabad"]
  },
  "services": [
    {
      "name": "House Cleaning",
      "description": "Complete house cleaning service",
      "price": 5000,
      "priceType": "fixed"
    }
  ],
  "tags": ["cleaning", "professional", "reliable"]
}
```

#### Get All Businesses
```http
GET /api/business?page=1&limit=10&city=Lahore&businessType=plumbing
```

#### Get Business by ID
```http
GET /api/business/:businessId
```

#### Update Business
```http
PUT /api/business/:businessId
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "description": "Updated business description",
  "contact": {
    "phone": "+923001234567",
    "email": "newemail@business.com"
  }
}
```

#### Get My Business
```http
GET /api/business/owner/my-business
Authorization: Bearer <jwt_token>
```

### User Management

#### Get User Profile
```http
GET /api/users/profile
Authorization: Bearer <jwt_token>
```

#### Update User Profile
```http
PUT /api/users/profile
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "firstName": "Updated Name",
  "phone": "+923001234567"
}
```

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: Bcrypt with salt rounds
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Validation**: Comprehensive request validation
- **CORS Protection**: Configurable cross-origin resource sharing
- **Security Headers**: Helmet.js for security headers
- **Session Management**: Secure session handling with MongoDB store

## 🧪 Testing

Run the test suite to verify all endpoints:

```bash
npm test
```

The test suite will:
- Test server health and connectivity
- Test user registration and login
- Test business creation and management
- Test API endpoints and error handling

## 🚨 Error Handling

The server includes comprehensive error handling:

- **Validation Errors**: Detailed field validation messages
- **Authentication Errors**: Clear JWT and session error messages
- **Database Errors**: Graceful MongoDB connection handling
- **Rate Limiting**: Informative rate limit exceeded messages
- **Global Error Handler**: Consistent error response format

## 📊 Monitoring & Logging

- **Request Logging**: All API requests with response times
- **Database Monitoring**: Connection status and health checks
- **Error Logging**: Detailed error logging for debugging
- **Performance Metrics**: Response time tracking

## 🔧 Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 5000 |
| `NODE_ENV` | Environment mode | development |
| `MONGO_URI` | MongoDB connection string | Required |
| `JWT_SECRET` | JWT signing secret | Required |
| `SESSION_KEY` | Session encryption key | Required |
| `FRONTEND_URL` | Frontend URL for CORS | http://localhost:3000 |

### Database Options

- Connection pooling (min: 2, max: 10)
- Auto-reconnection with exponential backoff
- Index optimization for queries
- Graceful shutdown handling

## 🚀 Deployment

### Production Considerations

1. **Environment Variables**
   - Set `NODE_ENV=production`
   - Use strong, unique secrets for JWT and sessions
   - Configure production MongoDB Atlas cluster

2. **Security**
   - Enable HTTPS in production
   - Configure proper CORS origins
   - Set secure cookie options

3. **Performance**
   - Enable MongoDB Atlas performance advisor
   - Monitor connection pool usage
   - Set appropriate rate limits

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

For support and questions:
- Check the API documentation
- Review error logs
- Test with the provided test suite
- Ensure environment variables are properly configured

## 🔄 Updates & Maintenance

- Regularly update dependencies
- Monitor MongoDB Atlas performance
- Review security configurations
- Backup database regularly
- Monitor error logs and performance metrics

