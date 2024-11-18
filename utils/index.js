const jwt = require('jsonwebtoken')
const cheerio = require('cheerio');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAi = require('openai')
require('dotenv').config()
const openai = new OpenAi({ apiKey: process.env.OPENAI_API_KEY })
const domainEnum = ['1']

const domains = {
    '1': "https://rias-aero.com"
}

function extractTextFromHTML(html) {
    // Load the HTML into Cheerio
    const $ = cheerio.load(html);

    // Extract and clean the text from the body (or the entire HTML)
    const textContent = $('body').text().trim().replace(/\n/g, '').replace(/\s\s/g, '') // You can use '$' instead of 'body' to extract from all HTML

    return textContent;
}

const timeOfCheck = {
    "1": "Once Per Day",
    "2": "Once Per 3 Days",
    "3": "Once Per Week",
    "4": "Once Per 2 Weeks",
    "5": "Once Per Month",
    "6": "Once Per 3 months",
    "7": "Once Per 6 months",
    "8": "Once Per Year"
}

const publishType = {
    "1": "Original",
    "2": "Rewrite",
    "3": "Summary",
}

async function GetArticleData(p, keywords, relevanceIndex, publishType) {
    try {
        return await GetArticleDataSchedule(p, keywords, relevanceIndex, publishType)
    }
    catch (e) {
        console.log(`error`)
        return await GetArticleData(p, keywords, relevanceIndex, publishType)
    }
}

const authMiddleWare = async (req, res, next) => {
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

const verifyToken = (token) => {
    const dataInJwt = jwt.verify(token, process.env.JWT_SECRET)
    return dataInJwt
}

async function Scrap(url) {
    const data = await axios.get(url)
    const cheerioData = cheerio.load(data.data, {
        xml: true,
    });
    const items = cheerioData('item')
    const urlArray = []
    Object.values(items).forEach((e) => {
        if (e.name == 'item') {
            e.children.forEach((j) => {
                if (j.name == 'link') {
                    urlArray.push(j.children[0].data)
                    // console.log('data',j.children[0].data)
                }
            })
        }
    })
    return urlArray
}

async function calculateRelevanceIndex(text, keywords, model) {
    const systemPrompt = `You are an AI model designed to assess the relevance of an article based on the following set of keywords:
${keywords}.

Your task is to calculate a relevance score on a scale from 0 to 1 for the article based on semantic relevance. This means you should evaluate how closely the content conceptually and contextually aligns with the keywords, considering the meaning, relationships, and context in which the keywords or their synonyms are used. Return only the relevance score as a number between 0 and 1.`
    const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            { role: "system", content: systemPrompt },
            {
                role: "user",
                content: text,
            },
        ],
    });
    // const result4 = await model.generateContent([systemPrompt, text]);
    console.log('openAi response relevance', console.log(completion.choices[0].message))
    const relevanceIndex = Number(completion.choices[0].message.content)
    return relevanceIndex
}

async function rewriteOrSummaryHtml(prompt, html, model) {
    // const result1 = await model.generateContent([prompt, html]);
    const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            { role: "system", content: prompt },
            {
                role: "user",
                content: html,
            },
        ],
    });
    return completion.choices[0].message.content.replace('\n', '').replace('##', '').replace('```', '').replace('```html', '').replace('html', '')
}

const dissbotFetchArticle = async (url) => {
    const token = process.env.DISSBOT_API
    const cheerio = require('cheerio');
    const readability = require('node-readability');

    return await new Promise((resolve,reject)=>{
        readability(url, function (err, article) {
            if (err) {
                console.error(err);
            } else {
                // console.log('Content:', article.content);
    
                // const text = extractTextFromHTML(article.content);
                // console.log('Extracted Text:', text);
                resolve({html:article.content,link:url,text:article.textBody,title:article.title})
            }
        });
    })




    





    // const dissbot_api_call = await axios.get(`https://api.diffbot.com/v3/article?url=${url}&token=${token}`)
    // const text = dissbot_api_call.data.objects[0].text
    // const html = dissbot_api_call.data.objects[0].html
    // const title = dissbot_api_call.data.objects[0].title
    // const link = dissbot_api_call.data.request.pageUrl
    // return { text, html, link, title }
}

const GetArticleDataSchedule = async (url, keywords, relevanceIndex, publishType) => {
    // const genAI = new GoogleGenerativeAI(process.env.GENAI_KEY)
    // const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const { text, html, link, title } = await dissbotFetchArticle(url)
    const relevanceIndexGemini = await calculateRelevanceIndex(text, keywords)
    console.log('gemini', relevanceIndexGemini)
    if (relevanceIndexGemini >= relevanceIndex) {
        if (publishType != '2' || publishType != '3') {
            return { relevanceIndex: relevanceIndexGemini, original: html, title, link }
        }
        if (publishType == '2') {
            const rewriteImage = await generateImage(title)
            const rewritePrompt = `You are an AI model tasked with rewriting HTML content provided by the user. Your goal is to update and rewrite the text content (headings, paragraphs, etc.) while ensuring the content is well-structured and relevant. You must remove all images from the HTML content. The only image that should remain is the one with the following URL, which should be included in the body of the content: ${rewriteImage}. Additionally, you should include the following URL at the bottom of the article: ${link}.`
            const rewriteHtml = await rewriteOrSummaryHtml(rewritePrompt, html)
            return { relevanceIndex: relevanceIndexGemini, rewritten: rewriteHtml, title, link }
        }
        const summaryPrompt = `You are an AI model tasked with summarizing HTML content provided by the user. Your goal is to create a concise summary of the text content within the HTML, while ensuring the content is well-structured and relevant. All images should be removed from the HTML content, regardless of their relevance to the summary. Additionally, you should include the following URL at the bottom of the article: ${link}. Please return the summary in HTML format, maintaining the overall structure of the content.`

        const summaryHtml = await rewriteOrSummaryHtml(summaryPrompt, html)
        return { relevanceIndex: relevanceIndexGemini, summary: summaryHtml, title, link }
    }
    return { message: "Low Relevance Score" }


}

const generateImage = async (title) => {
    const prompt = `"${title}" — Do not generate images of people under any circumstances.Instead, generate visuals that are relevant to the topic or theme of the title.The generated content should be appropriate and related to the subject matter, without featuring any individuals.`
    const response = await openai.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        style: "natural"
    });
    const image_url = response.data[0].url;
    return image_url
}


module.exports = { authMiddleWare, domains, verifyToken, Scrap, GetArticleDataSchedule, calculateRelevanceIndex, dissbotFetchArticle, rewriteOrSummaryHtml, domainEnum, generateImage, GetArticleData }