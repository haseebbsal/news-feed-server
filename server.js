require('dotenv').config()
const express = require('express')
const app = express()
const morgan = require('morgan')
const cors = require('cors')
const routeRouter = require('./routes')
// const formidableMiddleware = require('express-formidable');
const { default: mongoose } = require('mongoose')
const cron=require('node-cron')
const PORT = `${process.env.PORT}`
const helmet=require('helmet')
app.use(cors({
    origin: `${process.env.Allowed_Origins}`
}))
app.use(helmet())
app.use(morgan('dev'))
app.use(express.json())
// app.use(formidableMiddleware())
app.use('/api', routeRouter)

async function connect() {
    await mongoose.connect(process.env.DATABASE_URL)
    console.log('Connected To Database')
    app.listen(PORT, () => {
        console.log(`Server Started And Listening On Port ${PORT}`)
    })
}


// cron.schedule('* * * * *', () => {
//     console.log('running once')
// })
connect()