const express = require('express')
const articleRouter = express.Router()
const { authMiddleWare } = require('../utils')
const { publishArticle, scheduleArticle, getScheduledArticles, DeleteArticle, getAllPublishedArticles, updatePublishedArticle } = require('../controllers/article')
const { postScheduleValidation, publishArticleValidation, getScheduledArticleValidation, deleteArticleValidation, updateArticleValidation, getAllPublishedArticleValidation } = require('../utils/validations')

articleRouter.use(authMiddleWare)

articleRouter.post('/publish',publishArticleValidation,publishArticle)

articleRouter.post('/schedule',postScheduleValidation ,scheduleArticle)

articleRouter.get('/scheduledArticle',getScheduledArticleValidation,getScheduledArticles)

articleRouter.delete('/deleteArticle',deleteArticleValidation,DeleteArticle)

articleRouter.get('/publishedArticles',getAllPublishedArticleValidation,getAllPublishedArticles)

articleRouter.put('/update',updateArticleValidation,updatePublishedArticle)



module.exports=articleRouter

