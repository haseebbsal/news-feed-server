const express=require('express')
const { authMiddleWare } = require('../utils')
const { postDomains, getDomains, deleteDomain } = require('../controllers/admin')
const AdminRouter=express.Router()


AdminRouter.use(authMiddleWare)
AdminRouter.get('/domains',getDomains)
AdminRouter.post('/domains',postDomains)
// AdminRouter.delete('/domain',deleteDomain)


module.exports=AdminRouter