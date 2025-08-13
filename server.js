require('dotenv').config()
const express = require('express')
const app = express()
const morgan = require('morgan')
const cors = require('cors')
const routeRouter = require('./routes')
const {default: mongoose} = require('mongoose')
const cron = require('node-cron')
const PORT = `${process.env.PORT}`
const helmet = require('helmet')
const {scheduleModel, publishedArticleModel, profileModel} = require('./db-models')
const {default: axios} = require('axios')
const {Scrap, GetArticleDataSchedule, domains, GetArticleData} = require('./utils')
const moment = require('moment')
const cron_start = require('./scheduler')


app.use(cors({
    origin: `*`
}))
app.use(helmet())
app.use(morgan('dev'))
app.use(express.json({limit: "1tb"}))
app.use('/api', routeRouter)

async function connect() {
    await mongoose.connect(process.env.DATABASE_URL)
    console.log('Connected To Database')

    app.listen(PORT || 8080, () => {
        console.log(`Server Started And Listening On Port ${PORT}`)
    })
}

connect().then(r => cron_start.begin())