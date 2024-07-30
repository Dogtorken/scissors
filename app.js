const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const path = require('path');
const cors = require('cors');
require('dotenv').config();
const authRoutes = require('./URL-shortener/routes/authRoutes');
const shortenRoutes = require('./URL-shortener/routes/shortenRoutes');
const { checkUser } = require('./URL-shortener/middleware/authMiddleware');

const app = express();

// Enable CORS for all routes
app.use(cors());

// middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));

// view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Apply checkUser middleware to all routes
app.use(checkUser);

// routes
app.get('/', (req, res) => res.render('home'));
app.use(authRoutes); // Prefix auth routes with /auth  
app.use(shortenRoutes); // Keep shorten routes at root level

const port = process.env.PORT || 3000;

mongoose.connect(process.env.dbURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    bufferCommands: false,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
    console.log('Connected to database successfully...');
});

app.listen(port, () => {
    console.log(`Server listening on port:${port}`);
});

module.exports = app;