const express = require('express')
const userRouter = express.Router()
const jwt = require('jsonwebtoken');
const { individualUser, searchUser, deleteUser, blockUser, updateRollUser } = require('../controllers/user');
const { testRelevenceIndex } = require('../controllers/route-controllers');
require('dotenv').config()


userRouter.use(async (req, res, next) => {
    // console.log('here',req.headers.authorization)
    const accessToken = req.headers.authorization.split(' ')[1]
    // console.log(accessToken)
    try {
        const accessTokenData = jwt.verify(accessToken, process.env.JWT_SECRET)
        next()
    }
    catch {
        return res.status(400).json({
            message: "UnAuthorized"
        })
    }
})
userRouter.get('/individual',individualUser)
userRouter.get('/search',searchUser)
userRouter.delete('/delete', deleteUser)
userRouter.put('/block', blockUser)
userRouter.put('/updateRole',updateRollUser)
userRouter.post('/testgpt',testRelevenceIndex)

module.exports=userRouter