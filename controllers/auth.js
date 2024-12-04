const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const { userModel, scheduleModel } = require('../db-models')
const speakeasy = require('speakeasy');
const { sendEmail } = require('../utils');



const login = async (req, res) => {
    const { email, password } = req.body
    const findEmail = await userModel.findOne({ email })
    if (findEmail) {
        const userPassword = findEmail.password
        const comparePassword = await bcrypt.compare(password, userPassword)
        if (comparePassword) {
            const accessToken = jwt.sign({
                user: {
                    _id: findEmail._id,
                    email: findEmail.email,
                    username: findEmail.username,
                    role: findEmail.role
                }
            }, process.env.JWT_SECRET, {
                expiresIn: `${process.env.ACCESS_TOKEN_EXPIRY}`
            })
            const refreshToken = jwt.sign({
                user: {
                    _id: findEmail._id,
                    email: findEmail.email,
                    username: findEmail.username,
                    role: findEmail.role
                }
            }, process.env.JWT_SECRET, {
                expiresIn: `${process.env.REFRESH_TOKEN_EXPIRY}`
            })
            await userModel.updateOne({ _id: findEmail._id }, { $set: { refreshToken } })
            return res.status(200).json({
                user: {
                    _id: findEmail._id,
                    email: findEmail.email,
                    username: findEmail.username,
                    role: findEmail.role,
                    isBlocked: findEmail.isBlocked
                },
                accessToken,
                refreshToken
            })
        }
        return res.status(400).json({ message: "Invalid Credentials" })
    }
    return res.status(400).json({ message: "Invalid Credentials" })
}

const register = async (req, res) => {
    const { username, email, password } = req.body
    const checkUsernameExists = await userModel.findOne({ username })
    if (!checkUsernameExists) {
        const checkEmailExists = await userModel.findOne({ email })
        if (!checkEmailExists) {
            const saltRounds = 10;
            const newPassword = await bcrypt.hash(password, saltRounds)
            const generateVerifyCode = speakeasy.generateSecret({ length: 4 })
            const code = speakeasy.totp({
                secret: generateVerifyCode.base32,
                encoding: 'base32'
            });
            const sendEmailToClient = sendEmail(email, code,username)
            console.log('email sent', sendEmailToClient)
            const createNewUser = await userModel.create({ email, username, password: newPassword, verificationCode: code, isApproved: false })
            const createScheduleForUser = await scheduleModel.create({ userId: createNewUser._id })
            return res.status(200).json(createNewUser)
        }
        if(!checkUsernameExists.isApproved){
            return res.json({message:"User is not approved"})
        }
        return res.status(400).json({ message: 'email exists already' })
    }
    if(!checkUsernameExists.isApproved){
        return res.json({message:"User is not approved"})
    }
    return res.status(400).json({ message: 'username exists already' })
}


const verifyCode = async (req, res) => {
    const { code, username } = req.body
    const checkUsernameExists = await userModel.findOne({ username })
    if (checkUsernameExists.verificationCode == code) {
        await userModel.updateOne({ username }, { $set: { isApproved: true, verificationCode: 0 } })
        return res.json({ message: "Code Sent" })
    }
    return res.status(400).json({ message: 'Invalid Verification Code' })
}

const logout = async (req, res) => {
    const accessToken = req.headers.authorization.split(' ')[1]
    try {
        const accessTokenData = verifyToken(accessToken)
        const userId = accessTokenData.user._id
        await userModel.updateOne({ _id: userId }, { $set: { refreshToken: "" } })
        return res.json({
            message: "Success"
        })
    }
    catch {
        return res.json({
            message: "Success"
        })
    }
}


const resendVerification = async (req, res) => {
    const { username } = req.body
    try {
        const generateVerifyCode = speakeasy.generateSecret({ length: 4 })
        const code = speakeasy.totp({
            secret: generateVerifyCode.base32,
            encoding: 'base32'
        });
        const {email}=await userModel.findOne({username})
        await userModel.updateOne({username},{$set:{verificationCode:code}})
        const sendEmailToClient = sendEmail(email, code,username)
        console.log('send emailll',sendEmailToClient)
        return res.json({ message: "Sent New Code" })
    }
    catch{
        return res.status(400).json({message:"Error In Sending Verification Code"})
    }
}

const newTokens = async (req, res) => {
    const refreshToken = req.headers.authorization.split(' ')[1]
    try {
        const refreshTokenData = verifyToken(refreshToken)
        const userId = refreshTokenData.user._id
        const findUser = await userModel.findOne({ _id: userId })
        if (findUser.refreshToken == refreshToken) {
            const accessToken = jwt.sign({
                user: {
                    _id: findUser._id,
                    email: findUser.email,
                    username: findUser.username,
                    role: findUser.role
                }
            }, process.env.JWT_SECRET, {
                expiresIn: `${process.env.ACCESS_TOKEN_EXPIRY}`
            })
            const refreshToken = jwt.sign({
                user: {
                    _id: findUser._id,
                    email: findUser.email,
                    username: findUser.username,
                    role: findUser.role
                }
            }, process.env.JWT_SECRET, {
                expiresIn: `${process.env.REFRESH_TOKEN_EXPIRY}`
            })
            const updateUser = await userModel.updateOne({ _id: userId }, { $set: { refreshToken } })
            return res.status(200).json({
                user: {
                    _id: findUser._id,
                    email: findUser.email,
                    username: findUser.username,
                    role: findUser.role
                },
                accessToken,
                refreshToken
            })
        }
        return res.status(400).json({
            message: "Refresh Token Doesnt Match DB Refresh Token"
        })
    }
    catch (e) {
        console.log(e)
        return res.status(400).json({
            message: "Refresh Token Expired"
        })
    }
}

module.exports = {
    login, register, logout, newTokens, verifyCode,resendVerification
}