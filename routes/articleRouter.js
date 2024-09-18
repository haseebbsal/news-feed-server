const { default: axios } = require('axios')
const express = require('express')
const articleRouter = express.Router()
const jwt = require('jsonwebtoken')
const { scheduleModel } = require('../db-models')

articleRouter.use(async (req, res, next) => {
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
})

const domains={
    '1':"https://rias-aero.com"
}

articleRouter.post('/publish',async (req,res)=>{
    const {title,domain,article}=req.body
    const domainToPublishTo=domains[domain]
    const payload={
        title,
        "status":"publish",
        content:article
    }
    const publish=await axios.post(`${domainToPublishTo}/wp-json/wp/v2/posts`,payload)
    res.json(publish.data)

})

articleRouter.post('/schedule', async (req,res)=>{
    const {title,domain,article,scheduleDate}=req.body
    const {user}=jwt.verify(req.headers.authorization.split(' ')[1],process.env.JWT_SECRET)
    const findIfUserAlreadyScheduled= await scheduleModel.findOne({userId:user._id})
    return res.json(findIfUserAlreadyScheduled)
    // if(findIfUserAlreadyScheduled)

})
module.exports=articleRouter
// articleRouter.post('/new', (req, res) => {
//     const {
//         date,
//         article,
//         destinationUrl,
//         sourceUrl
//     }=req.body
// })
