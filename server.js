require('dotenv').config()
const express = require('express')
const app = express()
const morgan = require('morgan')
const cors = require('cors')
const routeRouter = require('./routes')
const { default: mongoose } = require('mongoose')
const cron = require('node-cron')
const PORT = `${process.env.PORT}`
const helmet = require('helmet')
const { scheduleModel, publishedArticleModel, profileModel,adminModel } = require('./db-models')
const { default: axios } = require('axios')
const { Scrap, GetArticleDataSchedule, domains, GetArticleData ,urltoFile} = require('./utils')
const moment = require('moment')
const { File } = require('undici');

app.use(cors({
    origin: `*`
}))
app.use(helmet())
app.use(morgan('dev'))
app.use(express.json({limit:"1tb"}))
app.use('/api', routeRouter)

async function connect() {
    await mongoose.connect(process.env.DATABASE_URL)
    console.log('Connected To Database')

    app.listen(PORT || 8080, () => {
        console.log(`Server Started And Listening On Port ${PORT}`)
    })
}



cron.schedule('* * * * *', async () => {
    console.log('cron job running')
    const getAllScheduled = await scheduleModel.find()
    if (getAllScheduled.length > 0) {
        for (let e of getAllScheduled) {
            const { relevanceIndex, keywords, timeOfCheck, timeCheckType, urls, _id, publishType, userId, domain: wordpressDomain, lowRelevanceArticles, periodicity, limit, generateImages } = e
            const currentDate = moment().format("YYYY-MM-DD")
            const hour= moment().hour()
            const minute= moment().minute()

            // const currentDate = '2025-05-15'
            // const hour=0
            // const minute= 0
            const nextDate = moment(new Date(timeOfCheck)).format("YYYY-MM-DD")
            console.log('currentDate', currentDate, 'current hour', hour, 'current minute', minute)
            console.log('Database Date', nextDate, 'current hour', periodicity.hour, 'current minute', periodicity.minute)
            if ((currentDate == nextDate) && hour == periodicity.hour && minute == periodicity.minute) {
                let totalArticleUrls = []
                let limitCheck = 0
                for (let j of urls) {
                    const articleUrlsArray = await Scrap(j)
                    totalArticleUrls = [...totalArticleUrls, ...articleUrlsArray]
                }

                for (let p of totalArticleUrls) {
                    const checkIfAlreadyPublishedUrl = await publishedArticleModel.findOne({ userId, articleUrl: p })
                    if (!checkIfAlreadyPublishedUrl && !lowRelevanceArticles.includes(p)) {
                        if (limitCheck != limit) {
                            const { message, relevanceIndex: relevanceIndexx, original, summary, rewritten, title, link, rewriteImage, files } = await new Promise(async (resolvee, reject) => {
                                resolvee(await GetArticleData(p, keywords, relevanceIndex, publishType, generateImages))
                            })

                            
                            limitCheck += 1
                            if (!message) {


                                if (original) {
                                    const payload = { title, "status": "publish", content: original }
                                    let domainToPublishTo = await adminModel.findOne({}, { domains: { $arrayElemAt: ["$domains", Number(wordpressDomain) - 1] } })
                                    domainToPublishTo = domainToPublishTo.domains[0].domain
                                    const uploadingToDomain = await axios.post(`${domainToPublishTo}/wp-json/wp/v2/posts`, payload)
                                    console.log(uploadingToDomain)
                                    const { id,message } = uploadingToDomain.data
                                    if (rewriteImage.length) {
                                        const formData = new FormData()
                                        formData.append('file', files[0])
                                        const puttingThumbnail = await axios.postForm(`${domainToPublishTo}/wp-json/wp/v2/upload_media?post_id=${id}`, formData)
                                    }
                                    if (!rewriteImage.length) {
                                        const getUserDefaultImage = await profileModel.findOne({ userId })
                                        if (getUserDefaultImage.defaultImage) {
                                            let file = await urltoFile(`${process.env.bucket_url}/${getUserDefaultImage.defaultImage}`)
                                            file = new File([new Blob([file])], 'anything.png')
                                            const formData = new FormData()
                                            formData.append('file', file)
                                            // console.log(files[0])
                                            const puttingThumbnail = await axios.postForm(`${domainToPublishTo}/wp-json/wp/v2/upload_media?post_id=${id}`, formData)
                                        }
                                    }
                                    const publishArticle = await publishedArticleModel.create({ userId, article: original, title, articleUrl: link, articleId: id, domain: wordpressDomain, publishType: '1', articleImage: rewriteImage })
                                    console.log('published Original Article', publishArticle._id)
                                    console.log('uploaded to wordpress', message)
                                }
                                else if (summary) {
                                    const payload = { title, "status": "publish", content: summary }
                                    let domainToPublishTo = await adminModel.findOne({}, { domains: { $arrayElemAt: ["$domains", Number(wordpressDomain) - 1] } })
                                    domainToPublishTo = domainToPublishTo.domains[0].domain
                                    const uploadingToDomain = await axios.post(`${domainToPublishTo}/wp-json/wp/v2/posts`, payload)
                                    console.log(uploadingToDomain)
                                    const { id ,message} = uploadingToDomain.data
                                    const getUserDefaultImage = await profileModel.findOne({ userId })
                                    if (getUserDefaultImage.defaultImage) {
                                        let file = await urltoFile(`${process.env.bucket_url}/${getUserDefaultImage.defaultImage}`)
                                        file = new File([new Blob([file])], 'anything.png')
                                        const formData = new FormData()
                                        formData.append('file', file)
                                        const puttingThumbnail = await axios.postForm(`${domainToPublishTo}/wp-json/wp/v2/upload_media?post_id=${id}`, formData)
                                    }
                                    // console.log(files[0])
                                    const puttingThumbnail = await axios.postForm(`${domainToPublishTo}/wp-json/wp/v2/upload_media?post_id=${id}`, formData)
                                    const publishArticle = await publishedArticleModel.create({ userId, article: summary, title, articleUrl: link, articleId: id, domain: wordpressDomain, publishType: '3' })
                                    console.log('published Summary Article', publishArticle._id)
                                    console.log('uploaded to wordpress', message)
                                }
                                else {
                                    const payload = { title, "status": "publish", content: rewritten }
                                    let domainToPublishTo = await adminModel.findOne({}, { domains: { $arrayElemAt: ["$domains", Number(wordpressDomain) - 1] } })
                                    domainToPublishTo = domainToPublishTo.domains[0].domain
                                    const uploadingToDomain = await axios.post(`${domainToPublishTo}/wp-json/wp/v2/posts`, payload)
                                    const { id, message } = uploadingToDomain.data
                                    if (rewriteImage.length) {
                                        const formData = new FormData()
                                        formData.append('file', files[0])
                                        const puttingThumbnail = await axios.postForm(`${domainToPublishTo}/wp-json/wp/v2/upload_media?post_id=${id}`, formData)
                                    }
                                    if (!rewriteImage.length) {
                                        const getUserDefaultImage = await profileModel.findOne({ userId })
                                        if (getUserDefaultImage.defaultImage) {
                                            let file = await urltoFile(`${process.env.bucket_url}/${getUserDefaultImage.defaultImage}`)
                                            file = new File([new Blob([file])], 'anything.png')
                                            const formData = new FormData()
                                            formData.append('file', file)
                                            const puttingThumbnail = await axios.postForm(`${domainToPublishTo}/wp-json/wp/v2/upload_media?post_id=${id}`, formData)
                                        }
                                    }
                                    const publishArticle = await publishedArticleModel.create({ userId, article: rewritten, title, articleUrl: link, articleId: id, domain: wordpressDomain, publishType: '2', articleImage: rewriteImage })
                                    console.log('published Rewritten Article', publishArticle._id)
                                    console.log('uploaded to wordpress', message)
                                }
                            }
                            else {
                                await scheduleModel.updateOne({ _id }, { $addToSet: { lowRelevanceArticles: p } })
                            }
                        }
                    }
                }
                let checkTime
                if (Number(timeCheckType) == 1) {
                    checkTime = moment().add(1, 'days');
                }
                else if (Number(timeCheckType) == 2) {
                    checkTime = moment().add(3, 'days');
                }
                else if (Number(timeCheckType) == 3) {
                    checkTime = moment().add(7, 'days');
                }
                else if (Number(timeCheckType) == 4) {
                    checkTime = moment().add(14, 'days');
                }
                else if (Number(timeCheckType) == 5) {
                    checkTime = moment().add(30, 'days');
                }
                else if (Number(timeCheckType) == 6) {
                    checkTime = moment().add(90, 'days');
                }
                else if (Number(timeCheckType) == 7) {
                    checkTime = moment().add(180, 'days');
                }
                else {
                    checkTime = moment().add(365, 'days');
                }
                await scheduleModel.updateOne({ _id }, { $set: { timeOfCheck: checkTime } })


            }
            console.log('not equal')
        }
    }
})
connect()