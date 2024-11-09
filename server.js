require('dotenv').config()
const express = require('express')
const app = express()
const morgan = require('morgan')
const cors = require('cors')
const routeRouter = require('./routes')
const { default: mongoose } = require('mongoose')
const cron=require('node-cron')
const PORT = `${process.env.PORT}`
const helmet=require('helmet')
const { scheduleModel, publishedArticleModel } = require('./db-models')
const { default: axios } = require('axios')
const { Scrap, GetArticleDataSchedule, domains } = require('./utils')
const moment=require('moment')
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

cron.schedule('* * * * *', async() => {
    const getAllScheduled=await scheduleModel.find()
    if(getAllScheduled.length>0){
        getAllScheduled.forEach((e)=>{
            const {relevanceIndex,keywords,timeOfCheck,timeCheckType,urls,_id,publishType,userId,domain:wordpressDomain}=e
            const currentDate=moment().format("YYYY-MM-DD")
            const nextDate=moment(new Date(timeOfCheck)).format("YYYY-MM-DD")
            if(currentDate==nextDate){
                urls?.forEach(async (j)=>{
                    const articleUrlsArray=await Scrap(j)
                    articleUrlsArray.forEach( async (p)=>{
                        const checkIfAlreadyPublishedUrl=await publishedArticleModel.findOne({userId,articleUrl:p})
                        if(!checkIfAlreadyPublishedUrl){
                            console.log('Not Published Already')
                            const {message,relevanceIndex,original,summary,rewritten,title,link}=await GetArticleDataSchedule(p,keywords,relevanceIndex,publishType)
                            if(!message){
                                if(original){
                                    const payload={title,"status":"publish",content:original}
                                    const domain=domains[wordpressDomain]
                                    const uploadingToDomain=await axios.post(`${domain}/wp-json/wp/v2/posts`,payload)
                                    const {id}=uploadingToDomain.data
                                    const publishArticle=await publishedArticleModel.create({userId,article:original,title,articleUrl:link,articleId:id,domain:wordpressDomain})
                                    console.log('published Original Article',publishArticle._id)
                                    console.log('uploaded to wordpress',uploadingToDomain)
                                    return
                                }
                                if(summary){
                                    const payload={title,"status":"publish",content:summary}
                                    const domain=domains[wordpressDomain]
                                    const uploadingToDomain=await axios.post(`${domain}/wp-json/wp/v2/posts`,payload)
                                    const {id}=uploadingToDomain.data
                                    const publishArticle=await publishedArticleModel.create({userId,article:summary,title,articleUrl:link,articleId:id,domain:wordpressDomain})
                                    console.log('published Summary Article',publishArticle._id)
                                    console.log('uploaded to wordpress',uploadingToDomain)
                                    return
                                }
                                const payload={title,"status":"publish",content:rewritten}
                                const domain=domains[wordpressDomain]
                                const uploadingToDomain=await axios.post(`${domain}/wp-json/wp/v2/posts`,payload)
                                const {id}=uploadingToDomain.data
                                const publishArticle=await publishedArticleModel.create({userId,article:rewritten,title,articleUrl:link,articleId:id,domain:wordpressDomain})
                                console.log('published Rewritten Article',publishArticle._id)
                                console.log('uploaded to wordpress',uploadingToDomain)
                                return
                            }
                        }
                    })
                })
            }
            console.log('not equal')
        })
    }
    console.log('cron job running')
})
connect()