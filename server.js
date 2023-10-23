const express = require('express');
const app = express();
const { pool, poolSecond } = require('./dbConfig');
const bcrypt = require('bcrypt');
const session = require('express-session');
const flash = require('express-flash');
const passport = require('passport');


const initializePassport = require('./passportConfig');

initializePassport(passport);

const PORT = process.env.PORT || 4000;


app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false}));

app.use(session({
    secret: 'secret',

    resave:false,

    saveUninitialized: false
}))
app.use(passport.initialize());
app.use(passport.session());

app.use(flash());

app.get('/',(req, res)=>{
    res.render('index');
});

app.get('/users/register', checkAuthenticated, (req,res)=>{
    res.render('register');
});

app.get('/users/login', checkAuthenticated, (req,res)=>{
    res.render('login');
}); 
 
  


// app.get('/users/dashboard', checkNotAuthenticated, (req, res) => {
//   if (req.user.role === 'seeker') {
//     res.render('dashboard', { user: req.user.name });
//   } else if (req.user.role === 'scraper') {
//     res.render('dashboardScraper', { user: req.user.name });
//   } else {
//     // Handle unrecognized role or display an error message
//     res.render('error', { message: 'Invalid role' });
//   }
// });



app.get('/users/logout', function(req, res, next) {
  req.logout(function(err) {
    if (err) { 
      return next(err); 
      }
    req.flash('success_msg', 'You have logged out');
    res.redirect('/users/login');
  });
});



app.post('/users/register', async (req, res) => {
  let { name, email, password, password2, role } = req.body;

  console.log({
    name,
    email,
    password,
    password2,
    role
  });

  let errors = [];

  if (!name || !email || !password || !password2 || !role) {
    errors.push({ message: 'Please enter all fields' });
  }

  if (password.length < 6) {
    errors.push({ message: 'Password should be at least 6 characters' });
  }

  if (password !== password2) {
    errors.push({ message: 'Passwords do not match' });
  }

  if (errors.length > 0) {
    res.render('register', { errors });
  } else {
    let hashedPassword = await bcrypt.hash(password, 10);
    console.log(hashedPassword);

    pool.query(
      `SELECT * FROM users WHERE email = $1`,
      [email],
      (err, results) => {
        if (err) {
          throw err;
        }

        console.log(results.rows);

        if (results.rows.length > 0) {
          errors.push({ message: 'Email already registered' });
          res.render('register', { errors });
        } else {
          pool.query(
            `INSERT INTO users (name, email, password, role)
            VALUES ($1, $2, $3, $4)
            RETURNING id, password`,
            [name, email, hashedPassword, role],
            (err, results) => {
              if (err) {
                throw err;
              }

              console.log(results.rows);
              req.flash('success_msg', 'You are now registered. Please log in');
              res.redirect('/users/login');
            }
          );
        }
      }
    );
  }
});


app.post('/users/dashboardScraper', async (req, res) => {
  try {
    const { location, type, salary } = req.body;

    // Validate the form data
    if (!location || !type || !salary) {
      req.flash('error_msg', 'Please enter all fields');
      return res.redirect('/users/dashboard'); // Redirect back to the dashboard
    }

    // Insert the data into the poolSecond database table
    const query = 'INSERT INTO jobinfo (location, type, salary) VALUES ($1, $2, $3)';
    const values = [location, type, salary];

    await poolSecond.query(query, values);

    req.flash('success_msg', 'Job info added');
    res.redirect('/users/dashboard'); // Redirect back to the dashboard
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/users/dashboard', checkNotAuthenticated, async (req, res) => {
  try {
    const { location, type, minSalary, maxSalary } = req.query;

    let query = 'SELECT * FROM jobinfo WHERE 1=1';
    let values = [];

    if (location) {
      query += ' AND location ILIKE $1';
      values.push(`%${location}%`);
    }

    if (type) {
      query += ' AND type ILIKE $2';
      values.push(`%${type}%`);
    }

    if (minSalary) {
      query += ' AND salary >= $3';
      values.push(parseInt(minSalary));
    }

    if (maxSalary) {
      query += ' AND salary <= $4';
      values.push(parseInt(maxSalary));
    }

    const result = await poolSecond.query(query, values);
    const jobinfo = result.rows;

    if (req.user.role === 'seeker') {
      res.render('dashboard', { user: req.user.name, jobinfo });
    } else if (req.user.role === 'scraper') {
      res.render('dashboardScraper', { user: req.user.name, jobinfo });
    } else {
      // Handle unrecognized role or display an error message
      res.render('error', { message: 'Invalid role' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

// app.get('/users/dashboard', checkNotAuthenticated, async (req, res) => {
//   try {
//     const { location, type, minSalary, maxSalary } = req.query;

//     let query = 'SELECT * FROM jobinfo WHERE 1=1';
//     let values = [];

//     if (location) {
//       query += ' AND location ILIKE $1';
//       values.push(`%${location}%`);
//     }

//     if (type) {
//       query += ' AND type ILIKE $2';
//       values.push(`%${type}%`);
//     }

//     if (minSalary) {
//       query += ' AND salary >= $3';
//       values.push(parseInt(minSalary));
//     }

//     if (maxSalary) {
//       query += ' AND salary <= $4';
//       values.push(parseInt(maxSalary));
//     }

//     const result = await poolSecond.query(query, values);
//     const jobinfo = result.rows;

//     res.render('dashboard', { user: req.user.name, jobinfo }); // Pass jobInfo to the view
//   } catch (err) {
//     console.error(err);
//     res.status(500).send('Internal Server Error');
//   }
// });

app.post('/users/login',
 passport.authenticate('local',{
    successRedirect: '/users/dashboard',
    failureRedirect: '/users/login',
    failureFlash: true
 }));

function checkAuthenticated(req,res,next){
    if(req.isAuthenticated()){
        return res.redirect('/users/dashboard');
    }
    next();
}

function checkNotAuthenticated(req,res,next){
    if (req.isAuthenticated()){
        return next();
    }

    res.redirect('/users/login');
}


app.listen(PORT, ()=>{
    console.log(`Server running on port ${PORT}`);
});
