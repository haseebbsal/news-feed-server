const jwt=require('jsonwebtoken')
const cheerio = require('cheerio');
const axios=require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const domainEnum=['1']

const domains={
    '1':"https://rias-aero.com"
}

const timeOfCheck={
"1":"Once Per Day",
"2":"Once Per Week",
"3":"Once Per Month",
"4":"Once Per Year"
}

const publishType={
    "1":"Original",
    "2":"Rewrite",
    "3":"Summary",
}

const authMiddleWare=async (req, res, next) => {
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
}

const verifyToken= (token)=>{
    const dataInJwt=jwt.verify(token,process.env.JWT_SECRET)
    return dataInJwt
}

async function Scrap(url){
    const data=await axios.get(url)
    const cheerioData = cheerio.load(data.data,{
        xml: true,
    });
    const items=cheerioData('item')
    const urlArray=[]
    Object.values(items).forEach((e)=>{
        if(e.name=='item'){
            e.children.forEach((j)=>{
                if(j.name=='link'){
                    urlArray.push(j.children[0].data)
                    // console.log('data',j.children[0].data)
                }
            })
        }
    })
    return urlArray
}

async function calculateRelevanceIndex(text,keywords,model){
    const systemPrompt=`You are an AI model designed to assess the relevance of an article based on the following set of keywords:
${keywords}.

Your task is to calculate a relevance score on a scale from 0 to 1 for the article based on semantic relevance. This means you should evaluate how closely the content conceptually and contextually aligns with the keywords, considering the meaning, relationships, and context in which the keywords or their synonyms are used. Return only the relevance score as a number between 0 and 1.`
    const result4 = await model.generateContent([systemPrompt, text]);
    const relevanceIndex=Number(result4.response.text())
    return relevanceIndex
}

async function rewriteOrSummaryHtml(prompt,html,model){
    const result1 = await model.generateContent([prompt, html]);
    return result1.response.text().replace('\n','').replace('##','')
}

const dissbotFetchArticle= async(url)=>{
    const token = process.env.DISSBOT_API
    const dissbot_api_call = await axios.get(`https://api.diffbot.com/v3/article?url=${url}&token=${token}`)
    const text = dissbot_api_call.data.objects[0].text
    const html = dissbot_api_call.data.objects[0].html
    const title = dissbot_api_call.data.objects[0].title
    const link = dissbot_api_call.data.request.pageUrl
    return {text,html,link,title}
}

const GetArticleDataSchedule=async (url,keywords,relevanceIndex,publishType)=>{
    const genAI = new GoogleGenerativeAI(process.env.GENAI_KEY)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const {text,html,link,title}=await dissbotFetchArticle(url)
    const relevanceIndexGemini=await calculateRelevanceIndex(text,keywords,model)
    console.log('gemini',relevanceIndexGemini)
    if(relevanceIndexGemini>=relevanceIndex){
        if(publishType!='2' || publishType!='3'){
            return {relevanceIndex:relevanceIndexGemini,original:html,title,link}
        }
        if(publishType=='2'){
            const rewritePrompt=`You are an AI model tasked with rewriting HTML content provided by the user. Your goal is to update and rewrite the text content (headings, paragraphs, etc.) while ensuring that the images are preserved exactly as they are (whether they are base64-encoded or external URLs).`
            const rewriteHtml=await rewriteOrSummaryHtml(rewritePrompt,html,model)
            return {relevanceIndex:relevanceIndexGemini,rewritten:rewriteHtml,title,link}
        }
        const summaryPrompt=`You are an AI model tasked with summarizing HTML content provided by the user. Your goal is to create a concise summary of the text content within the HTML while keeping the images and other non-text elements unchanged. The structure of the HTML must remain intact, and images should be preserved exactly as they are.`
        const summaryHtml=await rewriteOrSummaryHtml(summaryPrompt,html,model)
        return {relevanceIndex:relevanceIndexGemini,summary:summaryHtml,title,link}
    }
    return {message:"Low Relevance Score"}


}



module.exports={authMiddleWare,domains,verifyToken,Scrap,GetArticleDataSchedule,calculateRelevanceIndex,dissbotFetchArticle,rewriteOrSummaryHtml,domainEnum}