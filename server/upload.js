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

router.post("/uploadChunk", async ctx => {
    const { hash, name } = ctx.request.body;
    const file = ctx.request.files.chunk;
    const uploadDir = path.resolve(UPLOAD_DIR, hash);
    if (!fse.existsSync(uploadDir)) {
        fse.mkdirSync(uploadDir);
    }
    fse.moveSync(file.path, path.resolve(uploadDir, name));
    ctx.body = { code: 0, message: "上传成功" };
});

router.post("/mergefile", async ctx => {
    const { hash, ext } = ctx.request.body;
    const filename = path.resolve(UPLOAD_DIR, `${hash}.${ext}`);
    const dirname = path.resolve(UPLOAD_DIR, hash);
    if (!fse.existsSync(dirname)) {
        ctx.body = { code: 0, message: "文件目录不存在" };
        return;
    }
    const uploadList = fse
        .readdirSync(dirname)
        .map(v => path.resolve(dirname, v))
        .sort((a, b) => a.split("_")[1] - b.split("_")[1]);
    for (let i = 0; i < uploadList.length; i++) {
        fse.appendFileSync(filename, fse.readFileSync(uploadList[i]));
        fse.unlink(uploadList[i]);
    }
    ctx.body = { code: 0, message: "合并成功" };
});


module.exports = router