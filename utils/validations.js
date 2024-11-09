const { body, query, check } = require("express-validator")


const postScheduleValidation=[body('relevanceIndex').notEmpty().withMessage('RelevanceIndex is required').isNumeric().withMessage('Invalid Relevance Index type'),body('urls').optional().isArray().withMessage('Invalid Urls Type').custom((value)=>{
    if(value){
        value.forEach((e)=>{
            if(typeof e!="string"){
                throw new Error('Urls must contain only strings')
            }
        })
    }
    return true


}),body('domain').notEmpty().withMessage('Domain is required').isNumeric().withMessage('Domain Should Be A Number').custom((value)=>{
    const allowedValues=[1,2,3,4]
    if (!allowedValues.includes(Number(value))){
        throw new Error('Domain Should Be either 1,2,3,4')
    }
    return true
}),body('timeOfCheck').notEmpty().withMessage('TimeOfCheck is required').isNumeric().withMessage('Invalid TimeOfCheck Type').custom((value)=>{
    const allowedValues=[1,2,3,4]
    if (!allowedValues.includes(Number(value))){
        throw new Error('TimeOfCheck Should Be either 1,2,3,4')
    }
    return true
}),body('domain').notEmpty().withMessage('Domain is required').isNumeric().withMessage('Domain Should Be A Number').custom((value)=>{
    const allowedValues=[1,2,3,4]
    if (!allowedValues.includes(Number(value))){
        throw new Error('Domain Should Be either 1,2,3,4')
    }
    return true
}),body('publishType').notEmpty().withMessage('Publish Type Is Required').isNumeric().withMessage('Invalid Publish Type')]

const publishArticleValidation=[body('title').notEmpty().withMessage('Title Is Required').isString().withMessage('Invalid Title'),body('domain').notEmpty().withMessage('Domain is required').isNumeric().withMessage('Domain Should Be A Number'),body('article').notEmpty().withMessage('Article is required').isString().withMessage('Invalid Article Type'),body('articleUrl').notEmpty().withMessage('Article Url is required').isString().withMessage('Invalid Article Url Type')]

const deleteArticleValidation=[query('id').notEmpty().withMessage('Id is required').isString().withMessage('Invalid Id Type')]

const updateArticleValidation=[query('id').notEmpty().withMessage('Id is required').isNumeric().withMessage('Invalid Id Type'),body('content').optional().isString().withMessage('Invalid Content Type'),body('title').optional().isString().withMessage('Invalid Title Type')]

const getAllPublishedArticleValidation=[query('page').notEmpty().withMessage('Page is Required').isNumeric().withMessage('Invalid Page Type'),query('limit').notEmpty().withMessage('Limit is Required').isNumeric().withMessage('Invalid Limit Type')]

const getDissbotValidation=[body('url').notEmpty().withMessage('Url is Required').not().isNumeric().withMessage('Invalid Url Type'),body('keywords').notEmpty().withMessage('Keywords is Required').not().isNumeric().withMessage('Invalid Keywords Type'),body('relevanceIndex').notEmpty().withMessage('Relevance Index is Required').isNumeric().withMessage('Invalid Relevance Index Type')]

const getPublishedArticleValidation=[query('id').notEmpty().withMessage('Id is required').isNumeric().withMessage('Invalid Id Type')]
module.exports={postScheduleValidation,publishArticleValidation,deleteArticleValidation,updateArticleValidation,getAllPublishedArticleValidation,getDissbotValidation,getPublishedArticleValidation}