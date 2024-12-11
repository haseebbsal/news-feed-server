const { default: mongoose, mongo } = require("mongoose");
const { domainEnum } = require("./utils");

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
    },
    verificationCode:{
        type:Number,
    },
    isApproved:{
        type:Boolean,
        required:true
    }
})

const scheduleSchema=new mongoose.Schema({
    userId:{
        required:true,
        type:mongoose.Types.ObjectId,
        ref:"users"
    },
    urls:{
        type:[String],
        default:[]
    },
    relevanceIndex:{
        type:Number,
        default:0.6
    },
    keywords:{
        type:String,
        default:""
    },
    domain:{
        type:String,
        default:'1'
    },
    periodicity:{
        type:{hour:Number,minute:Number},
        default:{hour:0,minute:0}
    },
    timeOfCheck:{
        type:Date,
        default:null
    },
    timeCheckType:{
        type:Number,
        enum:[1,2,3,4,5,6,7,8],
        default:null
    },
    lowRelevanceArticles:{
        type:[String],
        default:[]
    },
    publishType:{
        type:String,
        enum:['1','2','3','4'],
        default:'2'
    },
    generateImages:{
        type:Boolean,
        default:false
    },
    limit:{
        type:Number,
        default:10
    }
},{timestamps:true})

const publishedArticlesSchema=new mongoose.Schema(
    {
        article:{
            type:String,
            required:true
        },
        title:{
            type:String,
            required:true
        },
        userId:{
            type:mongoose.SchemaTypes.ObjectId,
            required:true
        },
        articleUrl:{
            type:String
        },
        articleId:{
            type:Number,
            required:true
        },
        domain:{
            type:String,
            enum:domainEnum
        },
        publishType:{
            type:String,
            enum:['1','2','3','4'],
            required:true
        },
        articleImage:{
            type:[String]
        }
    },{timestamps:true}
)

const adminDomainSchema=new mongoose.Schema({
    domains:{
        type:[{domain:String}],
        required:true
    }
})

const profileSchema=new mongoose.Schema({
    defaultImage:{
        type:String,
    },
    userId:{
        type:mongoose.SchemaTypes.ObjectId,
        ref:"users",
        required:true
    }
})

const adminModel=mongoose.model('adminDomains',adminDomainSchema)

const publishedArticleModel=mongoose.model('publishedarticle',publishedArticlesSchema)

const scheduleModel=mongoose.model('schedule',scheduleSchema)

const userModel = mongoose.model('users', userSchema)

const profileModel=mongoose.model('profile',profileSchema)

module.exports={userModel,scheduleModel,publishedArticleModel,adminModel,profileModel}
