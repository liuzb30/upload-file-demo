const KoaRouter = require('koa-router')
const path = require('path')
const fse = require('fs-extra')
const UPLOAD_DIR = path.resolve(__dirname, '../static/upload')

const router = new KoaRouter({
    prefix: '/api'
})

router.get('/hello', ctx => {
    ctx.body = 'hello koa'
})

router.post('/uploadfile', ctx => {
    const { name } = ctx.request.body
    const file = ctx.request.files.file
    // 判断文件是否存在，没有则把临时文件拷贝到文件上传的目录
    const dest = path.resolve(UPLOAD_DIR, name)
    if (!fse.existsSync(dest)) {
        fse.moveSync(file.path, dest)
        ctx.body = { data: `/upload/${name}`, message: '文件上传成功' }
    } else {
        ctx.body = { message: "文件已经存在" }
    }
})

module.exports = router