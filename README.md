# Guide to the Directories

my-backend-app/
├── src/                   # All source code files of the website are placed here
│   ├── config/               # Directories for all configuration
│   │   └── supabase.js         # Supabase client initialization
│   ├── controllers/          # Route controllers of API (to be added)
│   ├── middleware/           # Auth & permission middleware (to be added)
│   ├── routes/               # API routes (to be added)
│   └── server.js             # Entry point / Express app skeleton
├── .env                      # Environment variables (local)
├── .env.example              # Template for environment variables
├── package.json
└── README.md

## .env.example 
the .env.example is the template to follow when initializing the database connection. If you were to run this to your local machine for testing, create a .env file and follow the template. Paste in your SUPABASE URL and SUPABASE SECRET KEY (in SUPABASE_SERVICE_ROLE_KEY).

## Project dependencies
This project relies on the following primary packages to run the backend engine:

##### Framework & Core
* **`express`**: A minimalist web framework for Node.js used to build our REST API endpoints, handle routing, and manage HTTP requests/responses.
* **`dotenv`**: A zero-dependency module that loads environment variables from a `.env` file into `process.env`, keeping sensitive keys safe and isolated from the codebase.

##### Database Interaction
* **`@supabase/supabase-js`**: The official isomorphic JavaScript client for Supabase. It provides the interface to interact with our database, handle authentication requests, and execute administrative bypass functions using the service role.

##### Security Middleware
* **`cors`**: Connect/Express middleware used to enable Cross-Origin Resource Sharing (CORS). This allows or restricts our frontend application from securely making requests to this backend from a different domain or port.
* **`helmet`**: A security wrapper that helps secure the Express app by setting various HTTP response headers, mitigating common vulnerabilities like clickjacking, cross-site scripting (XSS), and sniffing attacks.

##### Utility & Logging
* **`morgan`**: An HTTP request logger middleware for Node.js. It automatically prints incoming requests (method, URL, status code, response time) directly into the terminal console to make debugging easier during development.

Please do note that all of these dependencies are not included in the repository, but must be installed locally to run. To install all these dependencies, open your terminal, copy and paste:

npm install express dotenv cors helmet morgan @supabase/supabase-js