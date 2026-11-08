# Guide to the Directories

Scrum Master = DELIMA, Honey Mae D.

UI/UX developer = ORTIZ, NATALIA GABRILLE A.

Backend developer = JOMERO, Felijun

DevSecOps = FLORENTINO, Rex Matthew G.

Test Engineer = RAMOS, Christian Daryll Dave
<img width="637" height="244" alt="image" src="https://github.com/user-attachments/assets/1d34a19d-40f2-48cc-9d4d-e9d0d1c44846" />

## .env.example 
the .env.example is the template to follow when initializing the database connection. If you were to run this to your local machine for testing, create a .env file and follow the template. Here is a guide to the format. Copy and paste it to your .env file:

NODE_ENV=development
SUPABASE_URL= Paste in your SUPABASE URL here
SUPABASE_SERVICE_ROLE_KEY= SUPABASE SECRET KEY (in SUPABASE_SERVICE_ROLE_KEY).
SESSION_SECRET= This is for session management as Superadmin, type in here a string, serving as your password

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

npm install express dotenv cors helmet morgan @supabase/supabase-js bcryptjs express-session nodemailer

## Running the connected application

The Express backend serves the frontend and API together. Copy `.env.example` to `.env`, configure a server-only Supabase service-role key and a long random `SESSION_SECRET`, apply the SQL migrations in `db/migrations/` to the Supabase project, and run `npm start`. For local Live Server use, keep its origin in `FRONTEND_ORIGINS`; production should serve the UI and API on the same origin. Configure SMTP before production use so account setup and password reset messages can be delivered.

For the first administrator, register the intended operator through the sign-up page, then promote that account once in the Supabase SQL editor: `UPDATE public.users SET role = 'superadmin', status = 'approved', updated_at = NOW() WHERE email = lower('operator@example.com');`. Replace the address with the registered operator’s email. Do not expose a public administrator-registration endpoint.

Run `npm test` for the frontend table tests and backend API-schema contract tests. `GET /api/health` checks both the server and database connection.
