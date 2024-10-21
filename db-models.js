const { default: mongoose } = require("mongoose");
const { schedule } = require("node-cron");

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required:true
    },
    username: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    refreshToken: {
        type: String,
        default:""
    },
    isBlocked: {
        type: Boolean,
        default:false
    },
    role: {
        type: Number,
        default:1
    }
})

const individualSchedule=new mongoose.Schema({
    title:String,scheduleDate:String,content:String,domain:String
},{timestamps:true})

const scheduleSchema=new mongoose.Schema({
    userId:{
        required:true,
        type:mongoose.Types.ObjectId,
        ref:"users"
    },
    title:{
        type:String,
        required:true
    },
    scheduleDate:{
        type:Date,
        required:true
        
    },
    content:{
        type:String,
        required:true
    },
    domain:{
        type:String,
        required:true
    }
},{timestamps:true})

const scheduleModel=mongoose.model('schedule',scheduleSchema)
// const articlePublishingSchema = new mongoose.Schema({
//     userid: {
//         type: String,
//         required
//     },
//     articles: {
//         type:
//     }
// })

const userModel = mongoose.model('users', userSchema)

module.exports={userModel,scheduleModel}
