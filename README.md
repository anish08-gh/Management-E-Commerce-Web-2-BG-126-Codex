# ForgeCart

ForgeCart is a polished e-commerce experience built for the BackForge Hackathon. It combines a modern storefront interface with a working backend so the project feels complete both as a product demo and as an engineering submission.

The frontend is designed to feel fast, clean, and familiar to users. The backend turns that interface into a real application by powering authentication, cart persistence, checkout, and order history through a live API and MongoDB.

## Frontend first

### Product vision

ForgeCart is designed as a hackathon-ready merchandise platform where users can:

- Browse products from a responsive catalog
- View detailed product pages
- Register and log in
- Add items to a personal cart
- Complete checkout
- Review previous orders

The goal is not just to present screens, but to deliver a complete shopping flow with a strong presentation layer and real backend behavior behind it.

### User experience highlights

- Responsive multi-page storefront
- Search and category-based product discovery
- Product-focused card layout and detail views
- Clean checkout flow
- Order history visibility for authenticated users
- Persistent login and cart continuity

### Frontend stack

- HTML5
- CSS3
- Vanilla JavaScript
- Font Awesome

### Frontend architecture

The UI follows a static multi-page structure:

- `index.html` for catalog browsing
- `product.html` for product details
- `cart.html` for cart management
- `checkout.html` for order placement
- `orders.html` for order history
- `login.html` and `register.html` for authentication

Shared browser-side behavior is handled through:

- `js/api.js` for API communication and token handling
- `js/main.js` for page bootstrapping and user interaction logic
- `css/styles.css` for global styling and responsive behavior

### Why this presentation works for a demo

For judging, the frontend matters because it is the first proof of product thinking. ForgeCart is structured to show:

- Clear navigation and flow
- Real user journeys instead of isolated pages
- Consistent branding and interface language
- A UI that is not just decorative, but connected to working backend behavior

## Project structure

```text
Management-E-Commerce-Web-2/
|-- assets/                # Images and visual assets
|-- css/
|   `-- styles.css         # Shared frontend styling
|-- js/
|   |-- api.js             # API wrapper and auth token management
|   `-- main.js            # Page-level UI behavior
|-- scripts/
|   `-- bootstrapMongo.js  # Product bootstrap script for MongoDB
|-- cart.html
|-- checkout.html
|-- index.html
|-- login.html
|-- orders.html
|-- product.html
|-- register.html
|-- server.js              # Express server and API implementation
|-- package.json
|-- .env.example
`-- README.md
```

## Running the project

### Prerequisites

- Node.js 18+ recommended
- MongoDB running locally or a valid MongoDB connection string

### Environment variables

Create a `.env` file from `.env.example`:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/forgecart
PORT=3000
AUTH_TOKEN_TTL_DAYS=7
```

### Local setup

```bash
npm install
npm run bootstrap
npm start
```

Open `http://localhost:3000`.

## Backend implementation

### Backend overview

The backend is implemented with Express and MongoDB. It serves the frontend files and exposes the REST API used by the UI. This means the application runs as a single integrated system rather than a disconnected frontend mockup.

### Backend stack

- Node.js
- Express
- MongoDB
- Mongoose
- bcryptjs
- dotenv

### Backend responsibilities

The backend currently handles:

- User registration
- Secure password storage
- Persistent login sessions
- Product retrieval with filtering and search
- Cart creation and updates
- Checkout and order creation
- Order history retrieval
- Static asset and page serving

### Request lifecycle

1. The browser sends requests through `window.ForgeApi.request(...)`.
2. Requests target `/api/*` routes on the same server origin.
3. Protected endpoints read the bearer token from the `Authorization` header.
4. The server hashes the token and resolves the session from MongoDB.
5. The server loads the authenticated user and executes the requested business logic.
6. JSON responses are returned to the frontend and rendered in the UI.

### Authentication design

ForgeCart uses persistent bearer-session authentication backed by MongoDB.

- Passwords are stored using `bcrypt`
- Login generates a random session token
- Only the SHA-256 hash of the token is stored in MongoDB
- Sessions survive server restarts because they are database-backed
- Logout removes the current session from the database
- Expired sessions are cleaned automatically using a MongoDB TTL index
- Older legacy SHA-256 password hashes are upgraded to bcrypt after successful login

This approach gives the project a stronger security story than plain local storage auth or in-memory session state.

### Data model

The backend works with these collections:

- `products`
  - `id`, `name`, `category`, `price`, `image`, `description`, `inStock`
- `users`
  - `id`, `name`, `email`, `passwordHash`, `createdAt`
- `carts`
  - `userId`, `items[]`
- `orders`
  - `id`, `userId`, `timestamp`, `status`, `items[]`, `total`, `shipping`
- `sessions`
  - `tokenHash`, `userId`, `expiresAt`, `createdAt`

### API surface

#### Health

- `GET /api/health`

#### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

#### Products

- `GET /api/products`
- `GET /api/products/:id`

Supported product query parameters:

- `search`
- `category`

#### Cart

- `GET /api/cart`
- `POST /api/cart/items`
- `PATCH /api/cart/items/:productId`
- `DELETE /api/cart/items/:productId`

#### Orders

- `POST /api/orders`
- `GET /api/orders`

### Product bootstrap

`npm run bootstrap` upserts the product catalog into MongoDB. It is safe to run multiple times and is meant to initialize or refresh products without wiping users, carts, orders, or sessions.

### Operational notes

- The same Express app serves both the frontend and the API
- Auth sessions persist across server restarts
- The old JSON-file storage approach is no longer the active backend architecture
- MongoDB TTL cleanup is asynchronous, so expired sessions may remain briefly before cleanup runs

### Security notes

- Passwords are never stored in plaintext
- Session tokens are not stored directly in the database
- Protected routes require a valid bearer token

Current demo limitations:

- No rate limiting yet
- No CSRF protection layer
- No password reset or email verification flow
- No role-based admin authorization yet
- No automated test suite yet

## Why this project stands out

ForgeCart is not just a styled storefront and not just a backend API. It demonstrates both product presentation and implementation depth:

- A frontend that is demo-ready and easy to evaluate visually
- A backend that makes the flow real, persistent, and technically credible
- Clear full-stack integration from browser interaction to database state
- A structure that is practical for hackathon judging and extensible after the event

## License

This project is available for educational and hackathon use.
