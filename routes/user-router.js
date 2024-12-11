const express = require('express')
const userRouter = express.Router()
const { individualUser, searchUser, deleteUser, blockUser, updateRollUser, changePasswordUser, updateProfile, getProfile } = require('../controllers/user');
const { authMiddleWare} = require('../utils');
const multer=require('multer')
const upload = multer()
require('dotenv').config()


userRouter.use(authMiddleWare)
userRouter.get('/individual',individualUser)
userRouter.get('/search',searchUser)
userRouter.delete('/delete', deleteUser)
userRouter.put('/block', blockUser)
userRouter.put('/updateRole',updateRollUser)
userRouter.put('/change-password',changePasswordUser)
userRouter.put('/profile',upload.single('file'),updateProfile)
userRouter.get('/profile',getProfile)


module.exports=userRouter