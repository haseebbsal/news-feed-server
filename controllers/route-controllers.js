require('dotenv').config()
const { default: axios } = require('axios')
const { GoogleGenerativeAI } = require('@google/generative-ai')

function initalRoute(req, res) {
    res.json('Intial Route Working')
}

async function getURLArticle(req, res) {
    const { url,keywords } = req.body
    const token = process.env.DISSBOT_API
    const dissbot_api_call = await axios.get(`https://api.diffbot.com/v3/article?url=${url}&token=${token}`)
    const genAI = new GoogleGenerativeAI(process.env.GENAI_KEY)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const prompt = `Rewrite This Html and make it look completely different and just give me the rewritten html only `;
    const secondPrompt = `Give me a summary of this Html and just give me the summary html only`
    // const thirdPrompt ='Give me only the relevance index and nothing else in percentage without percent symbol  which tells me how similar the second article is compared with the first article'
    const text = dissbot_api_call.data.objects[0].text
    const html = dissbot_api_call.data.objects[0].html
    const title = dissbot_api_call.data.objects[0].title
    const link = dissbot_api_call.data.request.pageUrl
    const fourthPrompt =`Give me only the relevance index in ratio between 0-1 and nothing else which tells me if the keywords ${keywords} is mentioned in the article and if it is then how relevant is the article is to the keywords`
    // const result = await model.generateContent([prompt, body]);
    // const resultText=result.response.text()
    const result1 = await model.generateContent([prompt, html]);
    const result2 = await model.generateContent([secondPrompt, html]);
    const dataResult = result1.response.text()
    // const newText=`first article: ${text} and second article: ${dataResult}`
    // const result3 = await model.generateContent([thirdPrompt, newText]);
    const dataResult2 = result2.response.text()
    // const newTextt = `first article: ${text} and second article: ${dataResult2}`
    const result4 = await model.generateContent([fourthPrompt, text]);
    const data1 = {
        relevanceIndex:result4.response.text(),
        rewrittenArticle:dataResult
    }
    const data2 = {
        relevanceIndex: result4.response.text(),
        rewrittenArticle: dataResult2
    }
    const outputJson = {
        title,
        originalArticle: html,
        rewriteArticle: data1,
        link,
        summary: data2
    }
    res.json(outputJson)
}

async function testRelevenceIndex(req,res){
    const {body}=req.body
    const genAI = new GoogleGenerativeAI(process.env.GENAI_KEY)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const prompt ='Give me only the relevance index in ratio between 0-1 and nothing else which tells me if the keyword "Dominion" is mentioned in the article and if it is then how relevant is the article is to the keyword'
    const result = await model.generateContent([prompt, body]);
    const resultText=result.response.text()
    console.log('resultText',resultText)
    return res.json(resultText)
}
module.exports={initalRoute,getURLArticle,testRelevenceIndex}
