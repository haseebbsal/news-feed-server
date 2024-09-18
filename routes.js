const express = require('express')
const userRouter = require('./routes/user-router')
const routeRouter = express.Router()
const jwt=require('jsonwebtoken')
const articleRouter = require('./routes/articleRouter')
const { login, register, logout, newTokens } = require('./controllers/auth')
const { initalRoute, getURLArticle } = require('./controllers/route-controllers')
require('dotenv').config()

routeRouter.use('/user', userRouter)
routeRouter.use('/article',articleRouter)
routeRouter.get('/', initalRoute)
routeRouter.post('/login', login)
routeRouter.post('/register', register)
routeRouter.post('/logout', logout)
routeRouter.post('/url', async (req, res, next) => {
    const accessToken = req.headers.authorization.split(' ')[1]
    try {
        const accessTokenData = jwt.verify(accessToken, process.env.JWT_SECRET)
        next()
    }
    catch {
        return res.status(400).json({
            message: "UnAuthorized"
        })
    }
}, getURLArticle)
routeRouter.get('/tokens',newTokens)

module.exports=routeRouter