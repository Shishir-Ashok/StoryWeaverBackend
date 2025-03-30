const cors = require('cors');
const dotenv = require('dotenv');
const brcypt = require('bcryptjs');
const express = require('express');
const mongoose = require('mongoose');
const User = require('./models/user');
const jwt = require('jsonwebtoken');
dotenv.config();


const app = express();
app.use(cors({credentials: true, origin: 'http://localhost:5173'}));
app.use(express.json());

const salt = brcypt.genSaltSync(10);

mongoose.connect(process.env.MONGO_URI);

app.post('/signup', async(req, res) => {
    const { username, email, password } = req.body;
    
    try {
        const hashedPassword = await brcypt.hash(password, salt);
        const newUser = new User({ username, email, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ message: 'User created successfully', user: newUser });
    } catch (error) {
        console.error(error);
        // res.status(500).json({ error: error });
        if (error.code === 11000) {
            if (error.keyPattern.email) {
                res.status(400).json({ value: 'email', message: 'Email already exists' });
            }
            else {
                res.status(400).json({ value: 'username', message: 'Username already exists' });
            }
        }
    }
});


app.post('/signin', async(req, res) => {
    const {email, password} = req.body;
    const userDoc = await User.findOne({email});
    
    // Check if user exists
    if (!userDoc) {
        return res.status(400).json({message: 'Invalid credentials'});
    }

    // Verfy password
    const isPasswordCorrect = await brcypt.compareSync(password, userDoc.password);
    if (isPasswordCorrect) {
        // res.json({message: 'Login successful'});
        const token = jwt.sign({id: userDoc._id}, process.env.JWT_SECRET, {expiresIn: '1d'}, (err, token) => {
            if (err) {
                console.error(err);
                return res.status(500).json({message: 'Internal server error'});
            }
            else {
                res.cookie('token', token).json('ok');
            }
        });
    } else {
        res.status(400).json({message: 'Invalid credentials'});
    }
});

app.listen(process.env.PORT || 3000);