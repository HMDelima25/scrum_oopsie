<<<<<<< HEAD
# Guide to the Directories

<img width="637" height="244" alt="Screenshot 2026-11-01 175357" src="https://github.com/user-attachments/assets/6984f204-0b07-4936-9473-d0c99ad4c96c" />


## .env.example 
the .env.example is the template to follow when initializing the database connection. If you were to run this to your local machine for testing, create a .env file and follow the template. Here is a guide to the format. Copy and paste it to your .env file and manually paste/type in your Supabase URL, Supabase Key, and Session Key:

- NODE_ENV=development
- SUPABASE_URL= Paste in your SUPABASE URL here
- SUPABASE_SERVICE_ROLE_KEY= SUPABASE SECRET KEY (in SUPABASE_SERVICE_ROLE_KEY).
- SESSION_SECRET= This is for session management as Superadmin, type in here a string, serving as your password

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
=======
# scrum_oopsie
this is our first group project

scrum master = DELIMA, Honey Mae D.

ui/ux developer = ORTIZ NATALIA GABRIELLE A.

backend developer = JOMERO, Feljun B.

devsecops = FLORENTINO, Rex Matthew G.

test engineer = RAMOS, Christian Daryll Dave U.
>>>>>>> 9c1bf780c034bcf5355ceb165369875a67ecabfd
