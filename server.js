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
const { scheduleModel, publishedArticleModel } = require('./db-models')
const { default: axios } = require('axios')
const { Scrap, GetArticleDataSchedule, domains, GetArticleData } = require('./utils')
const moment = require('moment')
app.use(cors({
    origin: `*`
}))
app.use(helmet())
app.use(morgan('dev'))
app.use(express.json())
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
            const { relevanceIndex, keywords, timeOfCheck, timeCheckType, urls, _id, publishType, userId, domain: wordpressDomain, lowRelevanceArticles, periodicity } = e
            const currentDate = moment().format("YYYY-MM-DD")
            const nextDate = moment(new Date(timeOfCheck)).format("YYYY-MM-DD")
            if ((currentDate == nextDate) && moment().hour() == periodicity.hour && moment().minute() == periodicity.minute) {
                for (let j of urls) {
                    const articleUrlsArray = await Scrap(j)
                    for (let p of articleUrlsArray) {
                        const checkIfAlreadyPublishedUrl = await publishedArticleModel.findOne({ userId, articleUrl: p })
                        if (!checkIfAlreadyPublishedUrl && !lowRelevanceArticles.includes(p)) {
                            const { message, relevanceIndex: relevanceIndexx, original, summary, rewritten, title, link } = await new Promise(async (resolvee, reject) => {

                                resolvee(await GetArticleData(p, keywords, relevanceIndex, publishType))
                            })
                            if (!message) {


                                if (original) {
                                    const payload = { title, "status": "publish", content: original }
                                    const domain = domains[wordpressDomain]
                                    const uploadingToDomain = await axios.post(`${domain}/wp-json/wp/v2/posts`, payload)
                                    const { id } = uploadingToDomain.data
                                    const publishArticle = await publishedArticleModel.create({ userId, article: original, title, articleUrl: link, articleId: id, domain: wordpressDomain, publishType: '1' })
                                    console.log('published Original Article', publishArticle._id)
                                    console.log('uploaded to wordpress', uploadingToDomain.message)
                                }
                                else if (summary) {
                                    const payload = { title, "status": "publish", content: summary }
                                    const domain = domains[wordpressDomain]
                                    const uploadingToDomain = await axios.post(`${domain}/wp-json/wp/v2/posts`, payload)
                                    const { id } = uploadingToDomain.data
                                    const publishArticle = await publishedArticleModel.create({ userId, article: summary, title, articleUrl: link, articleId: id, domain: wordpressDomain, publishType: '3' })
                                    console.log('published Summary Article', publishArticle._id)
                                    console.log('uploaded to wordpress', uploadingToDomain.message)
                                }
                                else {

                                    const payload = { title, "status": "publish", content: rewritten }
                                    const domain = domains[wordpressDomain]
                                    const uploadingToDomain = await axios.post(`${domain}/wp-json/wp/v2/posts`, payload)
                                    const { id } = uploadingToDomain.data
                                    const publishArticle = await publishedArticleModel.create({ userId, article: rewritten, title, articleUrl: link, articleId: id, domain: wordpressDomain, publishType: '2' })
                                    console.log('published Rewritten Article', publishArticle._id)
                                    console.log('uploaded to wordpress', uploadingToDomain.message)
                                }
                            }
                            else {
                                await scheduleModel.updateOne({ _id }, { $addToSet: { lowRelevanceArticles: p } })
                            }
                        }
                    }
                }
                console.log('im hereeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')
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