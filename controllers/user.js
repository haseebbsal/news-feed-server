const jwt = require('jsonwebtoken')
const {userModel} = require('../db-models')
const { verifyToken } = require('../utils')
const bcrypt=require('bcrypt')

const individualUser = async (req, res) => {
    const accessToken = req.headers.authorization.split(' ')[1]
    const accessTokenData=verifyToken(accessToken)
    const userId = accessTokenData.user._id
    const userData = await userModel.findOne({ _id: userId })
    return res.json({
        message: "success",
        data: userData
    })

}

const searchUser = async (req, res) => {
    const accessToken=req.headers.authorization.split(' ')[1]
    const accessTokenData=verifyToken(accessToken)
    const userId = accessTokenData.user._id
    const { name, page } = req.query
    const limit = 10
    const nextPage = parseInt(page) * limit
    const skip = (parseInt(page) - 1) * limit
    const count = await userModel.find({ username: { $regex: `${name}`, $options: "i" },_id:{$ne: userId} }).countDocuments()
    // console.log('count', count)
    const user = await userModel.find({ username: { $regex: `${name}`, $options: "i" },_id:{$ne: userId} }, { refreshToken: 0, password: 0 }).limit(limit).skip(skip)
    res.json({
        message: "Success",
        data: {
            users: user,
            nextPage: nextPage >= count ? 0: parseInt(page) + 1
        }
    }
    )
}

const deleteUser=async (req, res) => {
    const { id } = req.query
    const deleteUser = await userModel.deleteOne({ _id: id })
    return res.json({
        message: "Success",
        data: deleteUser
    })
}

const blockUser = async (req, res) => {
    const { id } = req.query
    const userGet = await userModel.findOne({ _id: id })
    let updateUser
    if (userGet.isBlocked) {
        updateUser = await userModel.updateOne({ _id: id }, { $set: { isBlocked: false } })
    }
    else {
        updateUser = await userModel.updateOne({ _id: id }, { $set: { isBlocked: true } })
    }
    return res.json({
        message: "Success",
        data: updateUser
    })
}

const updateRollUser=async (req,res)=>{
    const {id}=req.query
    const getUser=await userModel.findOne({_id:id})
    if(getUser.role==1){
        const updateUserToAdmin=await userModel.updateOne({_id:id},{$set:{role:2}})
        return res.json(updateUserToAdmin)
    }
    else{
        const updateAdminToUser=await userModel.updateOne({_id:id},{$set:{role:1}})
        return res.json(updateAdminToUser)
    }
}

const changePasswordUser=async(req,res)=>{
    const {id}=req.query
    const {password}=req.body
    const saltRounds = 10;
    const newPassword = await bcrypt.hash(password, saltRounds)
    const updateUser=await userModel.updateOne({_id:id},{$set:{password:newPassword}})
    return res.json(updateUser)
}


module.exports = {
    individualUser,searchUser,deleteUser,blockUser,updateRollUser,changePasswordUser
}