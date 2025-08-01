require('dotenv').config()

function initalRoute(req, res) {
    res.json('Intial Route Working')
}

module.exports={initalRoute}
