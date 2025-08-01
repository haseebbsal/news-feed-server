const express = require('express')
const articleRouter = express.Router()
const { authMiddleWare } = require('../utils')
const { publishArticle, scheduleArticle, getScheduledArticles, DeleteArticle, getAllPublishedArticles, updatePublishedArticle, getPublishedArticle, testOpenAi, launchSearch } = require('../controllers/article')
const { postScheduleValidation, publishArticleValidation, deleteArticleValidation, updateArticleValidation, getAllPublishedArticleValidation, getPublishedArticleValidation } = require('../utils/validations')

articleRouter.use(authMiddleWare)

articleRouter.post('/publish',publishArticleValidation,publishArticle)

articleRouter.post('/schedule',postScheduleValidation ,scheduleArticle)

articleRouter.get('/scheduledArticle',getScheduledArticles)

articleRouter.delete('/deleteArticle',deleteArticleValidation,DeleteArticle)

articleRouter.get('/publishedArticles',getAllPublishedArticleValidation,getAllPublishedArticles)
articleRouter.get('/publishedArticle',getPublishedArticleValidation,getPublishedArticle)

articleRouter.post('/launchSearch',launchSearch)

articleRouter.put('/update',updateArticleValidation,updatePublishedArticle)
articleRouter.post('/test',testOpenAi)



module.exports=articleRouter

