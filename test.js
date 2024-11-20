const extractt=require('article-parser')

const input = 'https://edition.cnn.com/business/live-news/fox-news-dominion-trial-04-18-23/index.html'
extractt.extract(input)
  .then(article => console.log(article))
  .catch(err => console.error(err))