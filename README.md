## AAA Services Directory

Modern service marketplace to discover, review, and message local service providers. This monorepo contains a Node.js/Express API with MongoDB and real‑time messaging via Socket.IO, plus a React frontend built with Create React App.

### Tech Stack
- Backend: Node.js, Express, MongoDB (Mongoose), Passport, JSON Web Tokens, express-session, connect-mongo, Helmet, express-rate-limit, Nodemailer, Socket.IO
- Frontend: React 18, React Router, React Hook Form, React Query, React Toastify, Slick Carousel

### Key Features
- User and Business authentication (email/password, Google, Facebook)
- Business profiles, categories, and search
- Reviews and ratings
- Complaints/help center and inquiry workflow (email notifications)
- Real-time 1:1 messaging between customers and businesses (Socket.IO)
- Admin dashboards for users, service providers, and complaints
- Production-ready security defaults (Helmet CSP, sessions, rate limiting)

---

## Monorepo Structure

```
Back-End/
  server/
    config/           # Database, Passport strategies, etc.
    middleware/       # Auth middleware
    models/           # Mongoose models (User, Business, Review, etc.)
    routes/           # REST API routes (auth, users, business, reviews, ...)
    services/         # Email service
    socket.js         # Socket.IO server and events
    server.js         # Express app entrypoint

Front End/
  public/             # Static assets
  src/                # React app
    components/       # Reusable UI components
    context/          # Auth and Socket providers
    pages/            # Route-level pages
    utils/            # Helpers
  package.json        # CRA scripts
```

---

## Prerequisites
- Node.js >= 16 and npm >= 8
- MongoDB (Local or Atlas)
- Gmail account with App Password (for email) — optional but recommended

---

## Backend Setup (Server)

All environment variables must be defined in the `.env` file inside `Back-End/server` only.

1) Create `Back-End/server/.env` with the following keys:

```env
# Choose ONE connection; local takes precedence if both are set
MONGO_URI_LOCAL=mongodb://localhost:27017/aaa_services
MONGO_URI= # mongodb+srv://<user>:<pass>@<cluster>/<db>?retryWrites=true&w=majority

# Security
JWT_SECRET=change-me
SESSION_KEY=change-me-too

# Networking
PORT=5000
FRONTEND_URL=http://localhost:3000

# Email (optional but used by help center and password reset)
GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=your-app-password

NODE_ENV=development
```

2) Install dependencies and run (in two terminals):

```bash
cd Back-End/server
npm install
npm run dev    # starts API at http://localhost:5000
```

Health checks:
- GET `http://localhost:5000/` → API health payload
- GET `http://localhost:5000/api/status` → DB/uptime status

Notes:
- A default super admin is initialized on first boot if none exists (see `Admin.initializeDefaultSuperAdmin()`).
- Sessions are stored in MongoDB; cookie name: `aaa-services-session`.
- CORS allows `FRONTEND_URL` and credentials by default.

---

## Frontend Setup (React)

```bash
cd "Front End"
npm install
npm start  # http://localhost:3000
```

The frontend assumes the API is available at `http://localhost:5000` during development and uses Socket.IO to connect there. If you change ports, update `FRONTEND_URL` in the backend `.env` and any hardcoded client URLs (for example, `SocketContext`).

Build for production:

```bash
npm run build
```

Optional GitHub Pages deploy (configured in `Front End/package.json`):

```bash
npm run predeploy
npm run deploy
```

---

## Run Scripts

Backend (`Back-End/server/package.json`):
- `npm run dev` → start API with nodemon on port 5000
- `npm start` → start API with node

Frontend (`Front End/package.json`):
- `npm start` → start CRA dev server on port 3000
- `npm run build` → production build to `Front End/build`
- `npm run deploy` → deploy `build/` to GitHub Pages (requires repo setup)

---

## REST API Overview

Base URL: `http://localhost:5000/api`

- Auth: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- Users: `POST /users/register`, `POST /users/login`, `GET /users/profile`, `PUT /users/profile`, `PUT /users/profile-picture`, `PUT /users/change-password`, `GET /users/:id`
- Business: `POST /business`, `GET /business`, `GET /business/:id`, `PUT /business/:id`, `DELETE /business/:id`, `GET /business/owner/my-business`
- Reviews: `POST /reviews`, `GET /reviews`
- Service Categories: `GET/POST/PUT/DELETE /service-categories` (see `routes/serviceCategories.js`)
- Complaints: `... /complaints` (see `routes/complaints.js`)
- Inquiry: `... /inquiry` (see `routes/inquiry.js`)
- Messaging: `... /messaging` (see `routes/messaging.js`)
- Help Center: `... /help-center` (see `routes/helpCenter.js`)

Utility:
- Health: `GET /`
- API Status: `GET /api/status`

Authentication & Sessions:
- Uses sessions and JWT. Passport local strategy is enabled by default; Google/Facebook are available when OAuth env vars are provided.

---

## Real‑Time Messaging (Socket.IO)

Server: Socket.IO is initialized in `Back-End/server/socket.js` and attached in `server.js`. Authentication uses the JWT (`Authorization: Bearer <token>` or `auth.token`).

Client: The `SocketProvider` connects to `http://localhost:5000` once the user is authenticated and exposes helpers such as `sendMessage`, `startTyping`, `stopTyping`, `markMessageAsRead`, `joinBusinessRoom`, and `deleteMessage`.

Events (selected):
- Emit: `send-message`, `typing-start`, `typing-stop`, `mark-read`, `delete-message`, `join-business`
- Receive: `message-sent`, `new-message`, `business-message`, `user-typing`, `user-stopped-typing`, `message-read`, `message-deleted`, `user-status-change`

Ensure `FRONTEND_URL` in backend `.env` matches your frontend origin for CORS and Socket.IO.

---

## Design & Routing Conventions
- Professional, business-first UI; consistent green color accents throughout.
- Prefer SEO-friendly slugs in URLs for business pages instead of numeric IDs.
- Optimize layouts for mobile-first experiences.

---

## Deployment Notes

Backend (Node/Express):
- Set `NODE_ENV=production`
- Provide `MONGO_URI` (Atlas recommended), `JWT_SECRET`, `SESSION_KEY`, and `FRONTEND_URL` for your deployed frontend domain
- Run with a process manager (e.g., PM2) or host-provided runner

Frontend (Static):
- Build with `npm run build`
- Serve the `build/` directory from your static host (GitHub Pages supported via `npm run deploy`)

Security:
- Helmet CSP is enabled; adjust directives if you serve third‑party scripts/styles
- Rate limiting defaults to 1000 req/15 min (increase/decrease per environment)

---

## Troubleshooting
- API exits immediately: check required env vars (`MONGO_URI or MONGO_URI_LOCAL`, `JWT_SECRET`, `SESSION_KEY`).
- CORS/Socket errors: verify `FRONTEND_URL` matches your frontend origin and that both run on expected ports (3000/5000).
- Mongo connection issues: ensure local MongoDB is running on 27017 or verify Atlas connection string.
- Emails not sending: configure `GMAIL_USER` and `GMAIL_APP_PASSWORD` (Gmail App Password, not account password).

---

## Contributing
Pull requests are welcome. For large changes, open an issue to discuss what you would like to change.

---

## License
ISC


