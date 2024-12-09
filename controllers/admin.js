const { adminModel } = require("../db-models")

const postDomains=async(req,res)=>{
    const {domains}=req.body
    const addToDomains=await adminModel.updateOne({},{$set:{domains}},{upsert:true})
    return res.json({message:"Done",data:addToDomains})
}

const getDomains=async (req,res)=>{
    const domains=await adminModel.findOne()
    return res.json({data:domains})
}

const deleteDomain=async(req,res)=>{
    const {id}=req.query
    const deleteDomain=await adminModel.updateOne({},{$pull:{domains:id}})
    return res.json({message:"Success",data:deleteDomain})
}


module.exports={postDomains,getDomains,deleteDomain}