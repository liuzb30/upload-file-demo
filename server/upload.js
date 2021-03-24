const KoaRouter = require('koa-router')

const router = new KoaRouter({
    prefix: '/api'
})

router.get('/hello', ctx => {
    ctx.body = 'hello koa'
})

module.exports = router