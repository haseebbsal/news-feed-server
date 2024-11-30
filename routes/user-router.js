const express = require('express')
const userRouter = express.Router()
const { individualUser, searchUser, deleteUser, blockUser, updateRollUser, changePasswordUser } = require('../controllers/user');
const { authMiddleWare} = require('../utils');
require('dotenv').config()


userRouter.use(authMiddleWare)
userRouter.get('/individual',individualUser)
userRouter.get('/search',searchUser)
userRouter.delete('/delete', deleteUser)
userRouter.put('/block', blockUser)
userRouter.put('/updateRole',updateRollUser)
userRouter.put('/change-password',changePasswordUser)

module.exports=userRouter