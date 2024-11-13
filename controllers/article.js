const { validationResult, check } = require("express-validator")
const { domains, verifyToken, calculateRelevanceIndex, dissbotFetchArticle, rewriteOrSummaryHtml } = require("../utils")
const { scheduleModel, publishedArticleModel } = require("../db-models")
const moment=require('moment')
const { GoogleGenerativeAI } = require("@google/generative-ai")
const { default: axios } = require("axios")

const publishArticle=async (req,res)=>{
    const validateResult=validationResult(req)
    if(!validateResult.isEmpty()){
        const errors=validateResult.array().map((e)=>e.msg)
        return res.status(400).json({data:errors})
    }
    const accessToken = req.headers.authorization.split(' ')[1]
    const accessTokenData=verifyToken(accessToken)
    const userId = accessTokenData.user._id
    const {title,domain,article,articleUrl}=req.body
    const domainToPublishTo=domains[domain]
    const payload={
        title,
        "status":"publish",
        content:article
    }
    const publish=await axios.post(`${domainToPublishTo}/wp-json/wp/v2/posts`,payload)
    const articleId=publish.data.id
    const addToPublishDb=await publishedArticleModel.create({title,article,userId,articleUrl,articleId,domain})
    res.json({data:addToPublishDb})

}

const scheduleArticle=async (req,res)=>{
    const validateResult=validationResult(req)
    if(!validateResult.isEmpty()){
        const errors=validateResult.array().map((e)=>e.msg)
        return res.status(400).json({data:errors})
    }
    let {keywords,domain,urls,relevanceIndex,timeOfCheck,publishType}=req.body
    let checkTime
    if(Number(timeOfCheck)==1){
        checkTime=moment().add(1, 'days');
    }
    else if(Number(timeOfCheck)==2){
        checkTime=moment().add(7, 'days');
    }
    else if(Number(timeOfCheck)==3){
        checkTime=moment().add(30, 'days');
    }
    else{
        checkTime=moment().add(365, 'days');
    }

    const token=req.headers.authorization.split(' ')[1]
    const {user}=verifyToken(token)
    try{
        const addToScheduledData=await scheduleModel.updateOne({userId:user._id},{"$set":{urls,keywords,domain,relevanceIndex,timeOfCheck:checkTime,timeCheckType:timeOfCheck,publishType}},{upsert:true})
        return res.json({message:"Success",data:addToScheduledData})
    }
    catch(e){
        console.log(e)
        return res.status(400).json({message:"Fail",data:e})
    }


}

const getScheduledArticles= async (req,res)=>{
    const token=req.headers.authorization.split(' ')[1]
    const {user}=verifyToken(token)
    const getScheduledArticle=await scheduleModel.findOne({userId:user._id},{userId:0})
    return res.json({data:getScheduledArticle})
}

const getPublishedArticle=async (req,res)=>{
    const validateResult=validationResult(req)
    if(!validateResult.isEmpty()){
        const errors=validateResult.array().map((e)=>e.msg)
        return res.status(400).json({data:errors})
    }

    const {id}=req.query
    const getPublishedArticle=await publishedArticleModel.findOne({articleId:id})
    if(getPublishedArticle){
        return res.json({data:getPublishedArticle})
    }
    return res.status(400).json({message:"Id Doesnt Exist"})
}

const GetArticleDataNotSchedule=async (req,res)=>{
    const validateResult=validationResult(req)
    if(!validateResult.isEmpty()){
        const errors=validateResult.array().map((e)=>e.msg)
        return res.status(400).json({data:errors})
    }
    const {url,keywords,relevanceIndex}=req.body
    const genAI = new GoogleGenerativeAI(process.env.GENAI_KEY)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const {text,html,link,title}=await dissbotFetchArticle(url)
    const relevanceIndexGemini=await calculateRelevanceIndex(text,keywords,model)
    console.log('gemini',relevanceIndexGemini)
    if(relevanceIndexGemini>=relevanceIndex){
        const rewritePrompt=`You are an AI model tasked with rewriting HTML content provided by the user. Your goal is to update and rewrite the text content (headings, paragraphs, etc.) while ensuring that the images are preserved exactly as they are (whether they are base64-encoded or external URLs).`
        const summaryPrompt=`You are an AI model tasked with summarizing HTML content provided by the user. Your goal is to create a concise summary of the text content within the HTML. If the images are relevant to the summary, they should be preserved; otherwise, they can be removed. The structure of the HTML should be maintained, with non-text elements included only when necessary for the summary.`
        const rewriteHtml=await rewriteOrSummaryHtml(rewritePrompt,html,model)
        const summaryHtml=await rewriteOrSummaryHtml(summaryPrompt,html,model)

        return res.json({relevanceIndex:relevanceIndexGemini,rewritten:rewriteHtml,summary:summaryHtml,original:html,title,link})
    }
    return res.status(400).json({message:"Article Has Low Relevance Score"})
}

const DeleteArticle=async (req,res)=>{
    const validateResult=validationResult(req)
    if(!validateResult.isEmpty()){
        const errors=validateResult.array().map((e)=>e.msg)
        return res.status(400).json({data:errors})
    }
    const {id}=req.query
    const getPublishedData=await publishedArticleModel.findOne({articleId:id})
    if(getPublishedData){
        const wordpressDomain=domains[getPublishedData.domain]
        const deleteFromWordPress=await axios.delete(`${wordpressDomain}/wp-json/wp/v2/posts/${id}`)
        const deleteFromDB=await publishedArticleModel.deleteOne({articleId:id})
        return res.json({data:deleteFromDB})
    }
    return res.status(400).json({message:"Id Doesnt Exist"})

}

const getAllPublishedArticles=async (req,res)=>{
    const validateResult=validationResult(req)
    if(!validateResult.isEmpty()){
        const errors=validateResult.array().map((e)=>e.msg)
        return res.status(400).json({data:errors})
    }
    let {page,limit}=req.query
    limit=Number(limit)
    page=Number(page)
    const skip=(page-1)*limit
    const numberOfDocumentsToReturn=page*limit
    const accessToken = req.headers.authorization.split(' ')[1]
    const accessTokenData=verifyToken(accessToken)
    const userId = accessTokenData.user._id
    const totalDocuments=await publishedArticleModel.find({userId:userId}).countDocuments()
    const getAllPublishedForUser=await publishedArticleModel.find({userId:userId}).skip(skip).limit(limit)
    return res.json({data:getAllPublishedForUser,page,total:totalDocuments,nextPage:totalDocuments>numberOfDocumentsToReturn?page+1:0})
}

const updatePublishedArticle=async(req,res)=>{
    const validateResult=validationResult(req)
    if(!validateResult.isEmpty()){
        const errors=validateResult.array().map((e)=>e.msg)
        return res.status(400).json({data:errors})
    }

    const {id}=req.query
    const getPublishedData=await publishedArticleModel.findOne({articleId:id})
    if(getPublishedData){
        const wordpressDomain=domains[getPublishedData.domain]
        const updateFromWordPress=await axios.post(`${wordpressDomain}/wp-json/wp/v2/posts/${id}`,req.body)
        const updateFromDB=await publishedArticleModel.updateOne({articleId:id},{$set:{article:req.body.content,title:req.body.title}})
        return res.json({data:updateFromDB})
    }
    return res.status(400).json({message:"Id Doesnt Exist"})


}

module.exports={scheduleArticle,getScheduledArticles,publishArticle,GetArticleDataNotSchedule,DeleteArticle,getAllPublishedArticles,updatePublishedArticle,getPublishedArticle}