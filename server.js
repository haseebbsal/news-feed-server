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
const { scheduleModel } = require('./db-models')
const { default: axios } = require('axios')
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


cron.schedule('* * * * *', async() => {
    const getAllScheduled=await scheduleModel.find()
    getAllScheduled.forEach(async (e)=>{
        try{
            const {title,domain,content,_id,scheduleDate}=e
            const payload={
                title,
                "status":"publish",
                content
            }
            if(new Date().toLocaleDateString()==new Date(scheduleDate).toLocaleDateString()){
                const uploadingToDomain=await axios.post(`${domain}/wp-json/wp/v2/posts`,payload)
                console.log('Uploaded To Domain')
                const deleteAfterUploading=await scheduleModel.deleteOne({_id})
                console.log('Deleted the Scheduled Article')
            }
        }
        catch(e){
            console.log('error',e)
        }
        // console.log('current Date',new Date().toLocaleDateString(),'database',new Date(e.scheduleDate).toLocaleDateString())
    })
    // console.log(getAllScheduled)
    console.log('running once')
})
connect()