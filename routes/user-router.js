const express = require('express')
const userRouter = express.Router()
const { individualUser, searchUser, deleteUser, blockUser, updateRollUser } = require('../controllers/user');
const { authMiddleWare} = require('../utils');
require('dotenv').config()


userRouter.use(authMiddleWare)
userRouter.get('/individual',individualUser)
userRouter.get('/search',searchUser)
userRouter.delete('/delete', deleteUser)
userRouter.put('/block', blockUser)
userRouter.put('/updateRole',updateRollUser)

module.exports=userRouter