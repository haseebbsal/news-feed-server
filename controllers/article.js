const { validationResult, check } = require("express-validator")
const { domains, verifyToken, calculateRelevanceIndex, dissbotFetchArticle, rewriteOrSummaryHtml, generateImage, GetArticleData, Scrap, recursionGenerateImage, SaveToBucket, DeleteFromBucket, Manipulate, urltoFile } = require("../utils")
const { scheduleModel, publishedArticleModel, adminModel, profileModel } = require("../db-models")
const moment = require('moment')
const { GoogleGenerativeAI } = require("@google/generative-ai")
const { default: axios } = require("axios")
require('dotenv').config()
const OpenAi = require('openai')
const openai = new OpenAi({ apiKey: process.env.OPENAI_API_KEY })




const publishArticle = async (req, res) => {
    const validateResult = validationResult(req)
    if (!validateResult.isEmpty()) {
        const errors = validateResult.array().map((e) => e.msg)
        return res.status(400).json({ data: errors })
    }
    const accessToken = req.headers.authorization.split(' ')[1]
    const accessTokenData = verifyToken(accessToken)
    const userId = accessTokenData.user._id
    let { title, domain, article, articleUrl, publishType, } = req.body
    let domainToPublishTo = await adminModel.findOne({}, { domains: { $arrayElemAt: ["$domains", Number(domain) - 1] } })
    domainToPublishTo = domainToPublishTo.domains[0].domain
    const { html, keys, files } = await Manipulate(article)
    let content = html

    const payload = {
        title,
        "status": "publish",
        content
    }
    // articleImage = key
    const publish = await axios.post(`${domainToPublishTo}/wp-json/wp/v2/posts`, payload)
    const articleId = publish.data.id
    if (keys.length) {
        const formData = new FormData()
        formData.append('file', files[0])
        console.log(files[0])
        const puttingThumbnail = await axios.postForm(`${domainToPublishTo}/wp-json/wp/v2/upload_media?post_id=${articleId}`, formData)
    }
    if (!keys.length) {
        const { defaultImage } = await profileModel.findOne({ userId })
        if (defaultImage) {
            let file = await urltoFile(`${process.env.bucket_url}/${defaultImage}`)
            file = new File([new Blob([file])], 'anything.png')
            const formData = new FormData()
            formData.append('file', file)
            // console.log(files[0])
            const puttingThumbnail = await axios.postForm(`${domainToPublishTo}/wp-json/wp/v2/upload_media?post_id=${articleId}`, formData)
        }
    }
    const addToPublishDb = await publishedArticleModel.create({ title, article: content, userId, articleUrl, articleId, domain, publishType, articleImage: keys })
    res.json({ data: domainToPublishTo })

}

const scheduleArticle = async (req, res) => {
    const validateResult = validationResult(req)
    if (!validateResult.isEmpty()) {
        const errors = validateResult.array().map((e) => e.msg)
        return res.status(400).json({ data: errors })
    }
    let { keywords, domain, urls, relevanceIndex, timeOfCheck, publishType, periodicity, limit, generateImages } = req.body

    // console.log('limit',limit,'generate',generateImages)
    let checkTime
    if (Number(timeOfCheck) == 1) {
        checkTime = moment().add(1, 'days');
    }
    else if (Number(timeOfCheck) == 2) {
        checkTime = moment().add(3, 'days');
    }
    else if (Number(timeOfCheck) == 3) {
        checkTime = moment().add(7, 'days');
    }
    else if (Number(timeOfCheck) == 4) {
        checkTime = moment().add(14, 'days');
    }
    else if (Number(timeOfCheck) == 5) {
        checkTime = moment().add(30, 'days');
    }
    else if (Number(timeOfCheck) == 6) {
        checkTime = moment().add(90, 'days');
    }
    else if (Number(timeOfCheck) == 7) {
        checkTime = moment().add(180, 'days');
    }
    else {
        checkTime = moment().add(365, 'days');
    }

    const token = req.headers.authorization.split(' ')[1]
    const { user } = verifyToken(token)
    try {
        const getCurrentCheckTime = await scheduleModel.findOne({ userId: user._id })
        const currentSavedCheckTime = getCurrentCheckTime.timeCheckType
        if (currentSavedCheckTime != Number(timeOfCheck)) {
            const addToScheduledData = await scheduleModel.updateOne({ userId: user._id }, { "$set": { urls, keywords, domain, relevanceIndex, timeOfCheck: checkTime, timeCheckType: timeOfCheck, publishType, periodicity, limit, generateImages } }, { upsert: true })
            return res.json({ message: "Success", data: addToScheduledData })
        }
        else {
            const addToScheduledData = await scheduleModel.updateOne({ userId: user._id }, { "$set": { urls, keywords, domain, relevanceIndex, publishType, periodicity, limit, generateImages } }, { upsert: true })
            return res.json({ message: "Success", data: addToScheduledData })
        }
    }
    catch (e) {
        console.log(e)
        return res.status(400).json({ message: "Fail", data: e })
    }


}

const getScheduledArticles = async (req, res) => {
    const token = req.headers.authorization.split(' ')[1]
    const { user } = verifyToken(token)
    const getScheduledArticle = await scheduleModel.findOne({ userId: user._id }, { userId: 0 })
    return res.json({ data: getScheduledArticle })
}

const getPublishedArticle = async (req, res) => {
    const validateResult = validationResult(req)
    if (!validateResult.isEmpty()) {
        const errors = validateResult.array().map((e) => e.msg)
        return res.status(400).json({ data: errors })
    }

    const { id } = req.query
    const getPublishedArticle = await publishedArticleModel.findOne({ articleId: id })
    if (getPublishedArticle) {
        return res.json({ data: getPublishedArticle })
    }
    return res.status(400).json({ message: "Id Doesnt Exist" })
}

const GetArticleDataNotSchedule = async (req, res) => {
    const validateResult = validationResult(req)
    if (!validateResult.isEmpty()) {
        const errors = validateResult.array().map((e) => e.msg)
        return res.status(400).json({ data: errors })
    }
    const { url, keywords, relevanceIndex, generateImage } = req.body
    const { text, html, link, title } = await dissbotFetchArticle(url)
    const relevanceIndexGemini = await calculateRelevanceIndex(text, keywords)
    console.log('openAi', relevanceIndexGemini)
    if (relevanceIndexGemini >= relevanceIndex) {
        if (generateImage) {
            let rewriteImage = await recursionGenerateImage(title)
            const rewritePrompt = `You are an AI model tasked with rewriting HTML content provided by the user And Not Return Mark Down Content. Your goal is to update and rewrite the text content (headings, paragraphs, etc.) while ensuring the content is well-structured and relevant.
    
    Remove all images from the HTML content and make sure to add An image with the following URL: ${rewriteImage}, which should be included in the body of the content.
    At the very end of the article, include the following note in the exact specified format:
    "Article has been taken from [article domain]: <a href='${link}'>${link}</a>".
    Replace [article domain] with the actual domain from which the article is sourced (e.g., aviationweek.com), and make sure the link is wrapped in an <a> tag.
    `
            const summaryPrompt = `You are an AI model tasked with summarizing HTML content provided by the user in HTML format (not Markdown). Create a well-structured summary of the text content, removing all images, and ensuring the content remains very small, relevant and thorough. At the end of the summary, include the following HTML note: <p>Article has been taken from [article domain]: <a href='${link}'>${link}</a></p>, replacing [article domain] with the actual domain (e.g., aviationweek.com) and wrapping the link in an <a> tag.`
            const rewriteHtml = await rewriteOrSummaryHtml(rewritePrompt, html)
            const summaryHtml = await rewriteOrSummaryHtml(summaryPrompt, html)

            const original = html + summaryHtml.slice(summaryHtml.indexOf('<p>Article has been taken from'))
            return res.json({ relevanceIndex: relevanceIndexGemini, rewritten: rewriteHtml, summary: summaryHtml, original, title, link })
        }
        else {
            const rewritePrompt = `You are an AI model tasked with rewriting HTML content provided by the user And Not Return Mark Down Content. Your goal is to update and rewrite the text content (headings, paragraphs, etc.) while ensuring the content is well-structured and relevant.
    
            Remove all images from the HTML content.
            At the very end of the article, include the following note in the exact specified format:
            "Article has been taken from [article domain]: <a href='${link}'>${link}</a>".
            Replace [article domain] with the actual domain from which the article is sourced (e.g., aviationweek.com), and make sure the link is wrapped in an <a> tag.
            `
            const summaryPrompt = `You are an AI model tasked with summarizing HTML content provided by the user in HTML format (not Markdown). Create a well-structured summary of the text content, removing all images, and ensuring the content remains very small, relevant and thorough. At the end of the summary, include the following HTML note: <p>Article has been taken from [article domain]: <a href='${link}'>${link}</a></p>, replacing [article domain] with the actual domain (e.g., aviationweek.com) and wrapping the link in an <a> tag.`
            const rewriteHtml = await rewriteOrSummaryHtml(rewritePrompt, html)
            const summaryHtml = await rewriteOrSummaryHtml(summaryPrompt, html)

            const original = html + summaryHtml.slice(summaryHtml.indexOf('<p>Article has been taken from'))
            return res.json({ relevanceIndex: relevanceIndexGemini, rewritten: rewriteHtml, summary: summaryHtml, original, title, link })
        }
    }
    return res.status(400).json({ message: "Article Has Low Relevance Score" })
}

const DeleteArticle = async (req, res) => {
    const validateResult = validationResult(req)
    if (!validateResult.isEmpty()) {
        const errors = validateResult.array().map((e) => e.msg)
        return res.status(400).json({ data: errors })
    }
    const { id } = req.query
    const getPublishedData = await publishedArticleModel.findOne({ articleId: id })
    if (getPublishedData) {
        let domainToPublishTo = await adminModel.findOne({}, { domains: { $arrayElemAt: ["$domains", Number(getPublishedData.domain) - 1] } })
        domainToPublishTo = domainToPublishTo.domains[0].domain

        const deleteFromWordPress = await axios.delete(`${domainToPublishTo}/wp-json/wp/v2/posts/${id}`)
        if (getPublishedData.articleImage.length) {
            await DeleteFromBucket(getPublishedData.articleImage)
            console.log('deleted from bucket')
        }
        const deleteFromDB = await publishedArticleModel.deleteOne({ articleId: id })
        return res.json({ data: deleteFromDB })
    }
    return res.status(400).json({ message: "Id Doesnt Exist" })

}

const getAllPublishedArticles = async (req, res) => {
    const validateResult = validationResult(req)
    if (!validateResult.isEmpty()) {
        const errors = validateResult.array().map((e) => e.msg)
        return res.status(400).json({ data: errors })
    }
    let { page, limit } = req.query
    limit = Number(limit)
    page = Number(page)
    const skip = (page - 1) * limit
    const numberOfDocumentsToReturn = page * limit
    const accessToken = req.headers.authorization.split(' ')[1]
    const accessTokenData = verifyToken(accessToken)
    const userId = accessTokenData.user._id
    const totalDocuments = await publishedArticleModel.find({ userId: userId }).countDocuments()
    const getAllPublishedForUser = await publishedArticleModel.find({ userId: userId }).skip(skip).limit(limit).sort({ createdAt: -1 })
    return res.json({ data: getAllPublishedForUser, page, total: totalDocuments, nextPage: totalDocuments > numberOfDocumentsToReturn ? page + 1 : 0 })
}

const updatePublishedArticle = async (req, res) => {
    const validateResult = validationResult(req)
    if (!validateResult.isEmpty()) {
        const errors = validateResult.array().map((e) => e.msg)
        return res.status(400).json({ data: errors })
    }

    const { id } = req.query

    const accessToken = req.headers.authorization.split(' ')[1]
    const accessTokenData = verifyToken(accessToken)
    const userId = accessTokenData.user._id
    const getPublishedData = await publishedArticleModel.findOne({ articleId: id })
    if (getPublishedData) {
        let domainToPublishTo = await adminModel.findOne({}, { domains: { $arrayElemAt: ["$domains", Number(getPublishedData.domain) - 1] } })
        domainToPublishTo = domainToPublishTo.domains[0].domain
        const { html, keys, files } = await Manipulate(req.body.content)
        req.body.content = html
        let deleted = false
        if (getPublishedData.articleImage.length) {
            await DeleteFromBucket(getPublishedData.articleImage)
            deleted = true
        }
        if (keys.length) {
            const formData = new FormData()
            formData.append('file', files[0])
            const puttingThumbnail = await axios.postForm(`${domainToPublishTo}/wp-json/wp/v2/upload_media?post_id=${id}`, formData)
        }
        if (!keys.length) {
            const getUserDefaultImage = await profileModel.findOne({ userId })
            if (getUserDefaultImage.defaultImage) {
                let file = await urltoFile(`${process.env.bucket_url}/${getUserDefaultImage.defaultImage}`)
                file = new File([new Blob([file])], 'anything.png')
                const formData = new FormData()
                formData.append('file', file)
                // console.log(files[0])
                const puttingThumbnail = await axios.postForm(`${domainToPublishTo}/wp-json/wp/v2/upload_media?post_id=${id}`, formData)
            }
        }

        const updateFromWordPress = await axios.post(`${domainToPublishTo}/wp-json/wp/v2/posts/${id}`, req.body)
        const updateFromDB = await publishedArticleModel.updateOne({ articleId: id }, { $set: { article: html, title: req.body.title, articleImage: deleted ? keys : getPublishedData.articleImage } })
        return res.json({ data: updateFromDB })
    }
    return res.status(400).json({ message: "Id Doesnt Exist" })


}

const testOpenAi = async (req, res) => {
    const { url, keywords, relevanceIndex } = req.body
    // const genAI = new GoogleGenerativeAI(process.env.GENAI_KEY)
    // const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const { text, html, link, title } = await dissbotFetchArticle(url)
    // const relevanceIndexGemini = await calculateRelevanceIndex(text, keywords)
    const prompt = `${title} and dont generate actual person just generate something related`
    const response = await openai.images.generate({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        style: "natural"
    });
    const image_url = response.data[0].url;
    console.log(image_url)

    const rewritePrompt = `You are an AI model tasked with rewriting HTML content provided by the user. Your goal is to update and rewrite the text content (headings, paragraphs, etc.) while ensuring the content is well-structured and relevant. You must include an image with the following URL in the body of the content: ${image_url}. Additionally, you should include the following URL at the bottom of the article: ${link}.`

    const rewriteHtml = await rewriteOrSummaryHtml(rewritePrompt, html)
    return res.json({ data: rewriteHtml })
    // console.log('gemini',relevanceIndexGemini)
    // if(relevanceIndexGemini>=relevanceIndex){
    //     const rewritePrompt=`You are an AI model tasked with rewriting HTML content provided by the user. Your goal is to update and rewrite the text content (headings, paragraphs, etc.) while ensuring that the images are preserved exactly as they are (whether they are base64-encoded or external URLs).`
    const summaryPrompt = `You are an AI model tasked with summarizing HTML content provided by the user. Your goal is to create a concise summary of the text content within the HTML. All images should be removed from the content, regardless of their relevance to the summary. The structure of the HTML should be maintained, with non-text elements included only when necessary for the summary. Additionally, you should include the following image URL in the body of the content: [Insert image URL here]. Lastly, include the following URL at the bottom of the article: [Insert provided URL here].`
    //     const rewriteHtml=await rewriteOrSummaryHtml(rewritePrompt,html,model)
    //     const summaryHtml=await rewriteOrSummaryHtml(summaryPrompt,html,model)

    //     return res.json({relevanceIndex:relevanceIndexGemini,rewritten:rewriteHtml,summary:summaryHtml,original:html,title,link})
    // }
    // return res.status(400).json({message:"Article Has Low Relevance Score"})
    // const completion = await openai.chat.completions.create({
    //     model: "gpt-4o",
    //     messages: [
    //         { role: "system", content: "You are a helpful assistant." },
    //         {
    //             role: "user",
    //             content: "Write a haiku about recursion in programming.",
    //         },
    //     ],
    // });

    // console.log(completion.choices[0].message);
}

const launchSearch = async (req, res) => {
    const accessToken = req.headers.authorization.split(' ')[1]
    const accessTokenData = verifyToken(accessToken)
    const userId = accessTokenData.user._id
    const { relevanceIndex, keywords, timeOfCheck, timeCheckType, urls, _id, publishType, domain: wordpressDomain, lowRelevanceArticles, periodicity, limit, generateImages } = await scheduleModel.findOne({ userId })
    console.log('publishType', publishType)
    let totalPublished = 0
    let totalArticles = 0
    let allArticles = []
    const { defaultImage } = await profileModel.findOne({ userId })
    let limitCheck = 0
    if (urls.length > 0 && keywords) {
        for (let j of urls) {
            let articleUrlsArray
            try {
                articleUrlsArray = await Scrap(j)
            }
            catch {
                return res.status(400).json({ message: `${j} is not a valid RSS Feed` })
            }
            totalArticles += articleUrlsArray.length
            allArticles = [...allArticles, ...articleUrlsArray]
        }
        // console.log(allArticles)
        for (let p of allArticles) {
            if (limitCheck != limit) {
                const checkIfAlreadyPublishedUrl = await publishedArticleModel.findOne({ userId, articleUrl: p })
                if (!checkIfAlreadyPublishedUrl && !lowRelevanceArticles.includes(p)) {
                    const { message, relevanceIndex: relevanceIndexx, original, summary, rewritten, title, link, rewriteImage, files } = await new Promise(async (resolvee, reject) => {

                        resolvee(await GetArticleData(p, keywords, relevanceIndex, publishType, generateImages))
                    })
                    if (!message) {

                        totalPublished += 1
                        if (original) {
                            const payload = { title, "status": "publish", content: original }
                            let domainToPublishTo = await adminModel.findOne({}, { domains: { $arrayElemAt: ["$domains", Number(wordpressDomain) - 1] } })
                            domainToPublishTo = domainToPublishTo.domains[0].domain
                            const uploadingToDomain = await axios.post(`${domainToPublishTo}/wp-json/wp/v2/posts`, payload)
                            const { id } = uploadingToDomain.data
                            if (rewriteImage.length) {
                                const formData = new FormData()
                                formData.append('file', files[0])
                                const puttingThumbnail = await axios.postForm(`${domainToPublishTo}/wp-json/wp/v2/upload_media?post_id=${id}`, formData)
                            }
                            if (!rewriteImage.length) {
                                if (defaultImage) {
                                    let file = await urltoFile(`${process.env.bucket_url}/${defaultImage}`)
                                    file = new File([new Blob([file])], 'anything.png')
                                    const formData = new FormData()
                                    formData.append('file', file)
                                    // console.log(files[0])
                                    const puttingThumbnail = await axios.postForm(`${domainToPublishTo}/wp-json/wp/v2/upload_media?post_id=${id}`, formData)
                                }
                            }
                            const publishArticle = await publishedArticleModel.create({ userId, article: original, title, articleUrl: link, articleId: id, domain: wordpressDomain, publishType: '1' })
                            console.log('published Original Article', publishArticle._id)
                            console.log('uploaded to wordpress', uploadingToDomain.message)
                        }
                        else if (summary) {
                            const payload = { title, "status": "publish", content: summary }
                            let domainToPublishTo = await adminModel.findOne({}, { domains: { $arrayElemAt: ["$domains", Number(wordpressDomain) - 1] } })
                            domainToPublishTo = domainToPublishTo.domains[0].domain
                            const uploadingToDomain = await axios.post(`${domainToPublishTo}/wp-json/wp/v2/posts`, payload)
                            const { id } = uploadingToDomain.data
                            if (defaultImage) {
                                let file = await urltoFile(`${process.env.bucket_url}/${defaultImage}`)
                                file = new File([new Blob([file])], 'anything.png')
                                const formData = new FormData()
                                formData.append('file', file)
                                const puttingThumbnail = await axios.postForm(`${domainToPublishTo}/wp-json/wp/v2/upload_media?post_id=${id}`, formData)
                            }
                            // console.log(files[0])
                            const puttingThumbnail = await axios.postForm(`${domainToPublishTo}/wp-json/wp/v2/upload_media?post_id=${id}`, formData)
                            const publishArticle = await publishedArticleModel.create({ userId, article: summary, title, articleUrl: link, articleId: id, domain: wordpressDomain, publishType: '3' })
                            console.log('published Summary Article', publishArticle._id)
                            console.log('uploaded to wordpress', uploadingToDomain.message)

                        }
                        else {
                            const payload = { title, "status": "publish", content: rewritten }
                            let domainToPublishTo = await adminModel.findOne({}, { domains: { $arrayElemAt: ["$domains", Number(wordpressDomain) - 1] } })
                            domainToPublishTo = domainToPublishTo.domains[0].domain
                            const uploadingToDomain = await axios.post(`${domainToPublishTo}/wp-json/wp/v2/posts`, payload)
                            const { id } = uploadingToDomain.data
                            if (rewriteImage.length) {
                                const formData = new FormData()
                                formData.append('file', files[0])
                                const puttingThumbnail = await axios.postForm(`${domainToPublishTo}/wp-json/wp/v2/upload_media?post_id=${id}`, formData)
                            }
                            if (!rewriteImage.length) {
                                if (defaultImage) {
                                    let file = await urltoFile(`${process.env.bucket_url}/${defaultImage}`)
                                    file = new File([new Blob([file])], 'anything.png')
                                    const formData = new FormData()
                                    formData.append('file', file)
                                    // console.log(files[0])
                                    const puttingThumbnail = await axios.postForm(`${domainToPublishTo}/wp-json/wp/v2/upload_media?post_id=${id}`, formData)
                                }
                            }

                            const publishArticle = await publishedArticleModel.create({ userId, article: rewritten, title, articleUrl: link, articleId: id, domain: wordpressDomain, publishType: '2', articleImage: rewriteImage })
                            console.log('published Rewritten Article', publishArticle._id)
                            console.log('uploaded to wordpress', uploadingToDomain.message)
                        }

                        limitCheck += 1
                    }
                    else {
                        await scheduleModel.updateOne({ _id }, { $addToSet: { lowRelevanceArticles: p } })
                    }
                }
            }
            else {
                break
            }
        }

        return res.json({ data: "Search Completed", totalPublished, totalArticles: limit })
    }
    return res.status(400).json({ message: "Urls and Keywords Are Required To Search" })
}

module.exports = { scheduleArticle, getScheduledArticles, publishArticle, GetArticleDataNotSchedule, DeleteArticle, getAllPublishedArticles, updatePublishedArticle, getPublishedArticle, testOpenAi, launchSearch }