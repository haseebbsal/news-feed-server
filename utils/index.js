const jwt = require('jsonwebtoken')
const cheerio = require('cheerio');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAi = require('openai')
const extractt = require('article-parser')
const nodemailer = require('nodemailer')
require('dotenv').config()
const openai = new OpenAi({ apiKey: process.env.OPENAI_API_KEY })
const domainEnum = ['1']
const nanoidd = import('nanoid')
const S3 = require('@aws-sdk/client-s3')
const s3Client = new S3.S3({
    forcePathStyle: false, // Configures to use subdomain/virtual calling format.
    endpoint: "https://nyc3.digitaloceanspaces.com",
    region: "nyc3",
    credentials: {
        accessKeyId: process.env.spaces_access,
        secretAccessKey: process.env.spaces_secret
    }
})


const domains = {
    '1': "https://news.rias-aero.com"
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
    "4": "Custom"
}

const DeleteFromBucket = async (url) => {
    const params = {
        Bucket: "news-bucket", // The path to the directory you want to upload the object to, starting with your Space name.
        Key: url, // Object key, referenced whenever you want to access this file later.
    };

    await s3Client.send(new S3.DeleteObjectCommand(params))
    return 'deleted'
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
    // console.log('openAi response relevance', console.log(completion.choices[0].message))
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
    return completion.choices[0].message.content.replaceAll('\n', '').replaceAll('##', '').replaceAll('```', '').replaceAll('```html', '')
}

const dissbotFetchArticle = async (url) => {
    // const token = process.env.DISSBOT_API
    // const cheerio = require('cheerio');
    // const readability = require('node-readability');
    let content
    let title
    try {
        const data = await extractt.extract(url)
        content = data.content
        title = data.title

    }
    catch {
        console.log('error here')
        return { error: "no page exists" }
    }
    return await new Promise((resolve, reject) => {
        // readability(url, function (err, article) {
        //     if (err) {
        //         console.log('error', url)
        //         resolve({ error: "no page exists" })
        //     } else {
        //         const text = extractTextFromHTML(article.content);
        //         resolve({ html: article.content, link: url, text, title: article.title })
        //     }
        // });
        const text = extractTextFromHTML(content);
        resolve({ html: content, link: url, text, title: title })
    })










    // const dissbot_api_call = await axios.get(`https://api.diffbot.com/v3/article?url=${url}&token=${token}`)
    // const text = dissbot_api_call.data.objects[0].text
    // const html = dissbot_api_call.data.objects[0].html
    // const title = dissbot_api_call.data.objects[0].title
    // const link = dissbot_api_call.data.request.pageUrl
    // return { text, html, link, title }
}

const generateImage = async (title) => {
    const prompt = `"${title}" — Please generate visuals that are relevant to the topic or theme of the title. Do not generate images of people under any circumstances. Instead, focus on creating content that directly reflects the subject matter or theme. The generated content should be appropriate, related to the title, and comply with all safety and security guidelines.`
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

async function recursionGenerateImage(title) {
    try {
        return await generateImage(title)
    }
    catch {
        return await recursionGenerateImage(title)
    }
}

async function SaveToBucket(url) {
    const key = (await nanoidd).nanoid(9) + '.png'
    let image = await axios.get(url, { responseType: 'arraybuffer' });
    let returnedB64 = Buffer.from(image.data)
    const params = {
        Bucket: "news-bucket", // The path to the directory you want to upload the object to, starting with your Space name.
        Key: key, // Object key, referenced whenever you want to access this file later.
        Body: returnedB64, // The object's contents. This variable is an object, not a string.
        ACL: "public-read", // Defines ACL permissions, such as private or public.
    };
    const sendToBucket = await s3Client.send(new S3.PutObjectCommand(params))
    return { url: process.env.bucket_url + key, key }
}
const GetArticleDataSchedule = async (url, keywords, relevanceIndex, publishType) => {
    // const genAI = new GoogleGenerativeAI(process.env.GENAI_KEY)
    // const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
    const { text, html, link, title, error } = await dissbotFetchArticle(url)
    if (!error) {
        const relevanceIndexGemini = await calculateRelevanceIndex(text, keywords)
        console.log('gemini', relevanceIndexGemini)
        if (relevanceIndexGemini >= relevanceIndex) {
            if (publishType != '2' && publishType != '3') {
                return { relevanceIndex: relevanceIndexGemini, original: html, title, link }
            }
            if (publishType == '2') {
                const { url, key } = await SaveToBucket(await recursionGenerateImage(title))
                let rewriteImage = url
                const rewritePrompt = `You are an AI model tasked with rewriting HTML content provided by the user. Your goal is to update and rewrite the text content (headings, paragraphs, etc.) while ensuring the content is well-structured and relevant.

                Remove all images from the HTML content, except for the image with the following URL: ${rewriteImage}, which should be included in the body of the content.
                At the very end of the article, include the following note in the exact specified format:
                "Article has been taken from [article domain]: <a href='${link}'>${link}</a>".
                Replace [article domain] with the actual domain from which the article is sourced (e.g., aviationweek.com), and make sure the link is wrapped in an <a> tag.
                `
                const rewriteHtml = await rewriteOrSummaryHtml(rewritePrompt, html)
                return { relevanceIndex: relevanceIndexGemini, rewritten: rewriteHtml, title, link, rewriteImage: key }
            }
            const summaryPrompt = `You are an AI model tasked with summarizing HTML content provided by the user. Your goal is to create a detailed and comprehensive summary of the text content within the HTML, while ensuring the content remains well-structured and relevant.
                
            The summary should not be short and concise; instead, aim to include all key details, expand on important points, and provide a clear and thorough representation of the content.
            Remove all images from the HTML content, regardless of their relevance to the summary.
            At the very end of the article, on a separate line, include the following note in the exact specified format:
            <p>Article has been taken from [article domain]: <a href='${link}'>${link}</a></p>
            Replace [article domain] with the actual domain from which the article is sourced (e.g., aviationweek.com), and ensure the link is wrapped in an <a> tag.`

            const summaryHtml = await rewriteOrSummaryHtml(summaryPrompt, html)
            return { relevanceIndex: relevanceIndexGemini, summary: summaryHtml, title, link }
        }
        return { message: "Low Relevance Score" }

    }
    return { message: "Low Relevance Score" }


}


function emailTemplate(subject, userName, code, text = "Welcome To Search Please Enter The Code Provided.") {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
      body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
          background-color: #f4f4f4;
      }
      .container {
          width: 100%;
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          padding: 20px;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
          border-radius: 10px;
      }
      .header {
          text-align: center;
      }
      .header-text {
          text-align: center;
          border: 2px solid #ff6f61;
          border-radius: 20px;
          background-color: #fff0f0;

      }
      .header img {
          max-width: 150px;
      }
      .header h1 {
          font-size: 24px;
          color: #333333;
          border-radius: 5px;
      }

      .content {
          padding: 20px 0;
      }
      .content h2 {
          font-size: 20px;
          color: #333333;
      }
      .content p {
          font-size: 16px;
          color: #666666;
          line-height: 1.5;
      }
      .code-text{
          color: #ff6f61;
      }
      .footer {
          text-align: center;
          padding: 20px 0;
          background-color: #fff0f0;
          border-radius: 20px;

      }
      .footer p {
          font-size: 16px;
          color: #666666;
      }
      .footer a {
          font-size: 16px;
          color: #ff6f61;
          text-decoration: none;
      }
      .email__content__copyright__wrapper {
          text-align: center;
          margin-top: 30px;
      }

      .email__content__copyright__wrapper small {
          color: #666666;
          font-size: 12px;
          opacity: 0.9;
      }
  </style>
  <title>Riddle The City</title>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="header-text">
      <h1>${subject}</h1>
    </div>
  </div>
  <div class="content">
    <h2>Hey ${userName}!</h2>
    <p>${text}<br>
      <span class="code-text">${code}</span>
    </p>
  </div>
</div>
</body>
</html>`

return html
}



async function sendEmail(email, code,username) {
    var transport = nodemailer.createTransport({
        host: "live.smtp.mailtrap.io",
        port: 587,
        auth: {
            user: "api",
            pass: process.env.mailtrap_pass
        }
    });

    const sender = {
        address: "no-reply@rias-aero.com",
        name: "Welcome To Search",
    };
    const recipients = [
        email,
    ];

    const sendEmail = await transport
        .sendMail({
            from: sender,
            to: recipients,
            subject: "Verify Your Email",
            category: "Verify Email Category",
            html: emailTemplate("Verify Your Email",username,code)

        })

    return sendEmail
}


module.exports = { authMiddleWare, domains, verifyToken, Scrap, GetArticleDataSchedule, calculateRelevanceIndex, dissbotFetchArticle, rewriteOrSummaryHtml, domainEnum, generateImage, GetArticleData, recursionGenerateImage, SaveToBucket, DeleteFromBucket, sendEmail }