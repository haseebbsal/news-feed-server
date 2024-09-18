const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const {userModel} = require('../db-models')

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
        return res.status(400).json({ message: "Incorrect Password" })
    }
    return res.status(400).json({ message: "Incorrect Email" })
}

const register = async (req, res) => {
    const { username, email, password } = req.body
    const checkUsernameExists = await userModel.findOne({ username })
    if (!checkUsernameExists) {
        const checkEmailExists = await userModel.findOne({ email })
        if (!checkEmailExists) {
            const saltRounds = 10;
            const newPassword = await bcrypt.hash(password, saltRounds)
            const createNewUser = await userModel.create({ email, username, password: newPassword })
            return res.status(200).json(createNewUser)
        }
        return res.status(400).json({ message: 'email exists already' })
    }
    return res.status(400).json({ message: 'username exists already' })


}

const logout = async (req, res) => {
    const accessToken = req.headers.authorization.split(' ')[1]
    try {
        const accessTokenData = jwt.verify(accessToken, process.env.JWT_SECRET)
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

const newTokens = async (req, res) => {
    const refreshToken = req.headers.authorization.split(' ')[1]
    try {
        const refreshTokenData = jwt.verify(refreshToken, process.env.JWT_SECRET)
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
    login,register,logout,newTokens
}