<template>
  <div>
    <div ref="drag" id="drag">
      <input type="file" name="file" @change="handleFileChange" />
    </div>
    <div>
      <el-progress
        :stroke-width="20"
        :text-inside="true"
        :percentage="uploadProgress"
      ></el-progress>
    </div>
    <div>
      <el-button @click="uploadFile">上传</el-button>
    </div>
    <div class="cube-container" :style="{ width: cubeWidth + 'px' }">
      <div class="cube" v-for="chunk in chunks" :key="chunk.name">
        <div
          :class="{
            uploading: chunk.progress > 0 && chunk.progress < 100,
            success: chunk.progress === 100,
            error: chunk.progress === -1,
          }"
          :style="{ height: chunk.progress + '%' }"
        >
          <i
            class="el-icon-loading"
            style="color: #f56c6c"
            v-if="chunk.progress < 100 && chunk.progress > 0"
          ></i>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
const CHUNK_SIZE = 100 * 1024;
import sparkMD5 from "spark-md5";
export default {
  data() {
    return {
      uploadProgress: 0,
      chunks: [],
    };
  },
  mounted() {
    this.bindEvent();
  },
  computed: {
    cubeWidth() {
      return Math.ceil(Math.sqrt(this.chunks.length)) * 16;
    },
    ext() {
      return this.file.name.split(".")[1];
    },
  },
  methods: {
    bindEvent() {
      const dragEle = this.$refs.drag;
      dragEle.addEventListener("dragover", (e) => {
        drag.style.borderColor = "red";
        e.preventDefault();
      });
      dragEle.addEventListener("dragleave", (e) => {
        drag.style.borderColor = "#eee";
        e.preventDefault();
      });
      dragEle.addEventListener("drop", (e) => {
        const fileList = e.dataTransfer.files;
        drag.style.borderColor = "#eee";
        this.file = fileList[0];
        console.log(this.file);
        e.preventDefault();
      });
    },
    handleFileChange(e) {
      this.file = e.target.files[0];
    },
    async blobToStr(blob) {
      return new Promise((resolve) => {
        const fileReader = new FileReader();
        fileReader.onload = () => {
          const str = fileReader.result
            .split("")
            .map((v) => v.charCodeAt()) //转成字符编码
            .map((v) => v.toString(16).toUpperCase()) // 转成16进制并大写
            .map((v) => (v.length < 2 ? "0" + v : v)) // 不足两位的前面补0
            .join(" ");
          resolve(str);
        };
        fileReader.readAsBinaryString(blob);
      });
    },
    async isGif(file) {
      // 判断文件二进制前六位信息
      const ret = await this.blobToStr(file.slice(0, 6));
      console.log(ret);
      return ret === "47 49 46 38 39 61" || ret === "47 49 46 38 37 61";
    },
    async isPng(file) {
      // 前八位 '89 50 4E 47 0D 0A 1A 0A'
      const ret = await this.blobToStr(file.slice(0, 8));
      return ret === "89 50 4E 47 0D 0A 1A 0A";
    },
    async isJpg(file) {
      // 前两位 'FF D8' 后两位'FF D9'
      const head = await this.blobToStr(file.slice(0, 2));
      const tail = await this.blobToStr(file.slice(-2));
      return head === "FF D8" && tail === "FF D9";
    },
    async isImage(file) {
      return (
        (await this.isGif(file)) ||
        (await this.isPng(file)) ||
        (await this.isJpg(file))
      );
    },
    async createFileChunks(file) {
      const chunks = [];
      let cur = 0;
      while (cur < file.size) {
        chunks.push({ index: cur, chunk: file.slice(cur, cur + CHUNK_SIZE) });
        cur += CHUNK_SIZE;
      }
      return chunks;
    },
    async calculateHashWorker(chunks) {
      return new Promise((resolve) => {
        // 创建一个worker
        const worker = new Worker("/hash.js");
        // 把chunks传过去
        worker.postMessage({ chunks });
        // 监听处理进度
        worker.onmessage = (e) => {
          const { progress, hash } = e.data;
          if (!hash) {
            this.hashProgress = progress;
          } else {
            this.hashProgress = 100;
            resolve(hash);
          }
        };
      });
    },
    async calculateHashIdle(chunks) {
      return new Promise((resolve) => {
        let count = 0;
        const spark = new sparkMD5.ArrayBuffer();
        const appendToSpark = (file) => {
          return new Promise((resolve) => {
            const fileReader = new FileReader();
            fileReader.onload = () => {
              spark.append(fileReader.result);
              resolve();
            };
            fileReader.readAsArrayBuffer(file);
          });
        };
        const workLoop = async (deadling) => {
          while (count < chunks.length && deadling.timeRemaining() > 1) {
            // 把chunk加入spark
            await appendToSpark(chunks[count].chunk);
            count++;
            if (count < chunks.length) {
              this.hashProgress = Number(
                ((count * 100) / chunks.length).toFixed(2)
              );
            } else {
              this.hashProgress = 100;
              resolve(spark.end());
            }
          }
          window.requestIdleCallback(workLoop);
        };

        window.requestIdleCallback(workLoop);
      });
    },
    async calculateHashSample(chunks) {
      return new Promise((resolve) => {
        let tempChunks = [];
        // 截取chunks
        for (let i = 0; i < chunks.length; i++) {
          let chunk = chunks[i].chunk;
          if (i === 0 || i === chunks.length - 1) {
            tempChunks.push(chunk);
          } else {
            const mid = CHUNK_SIZE >> 1;
            tempChunks.push(chunk.slice(0, 2));
            tempChunks.push(chunk.slice(mid, mid + 2));
            tempChunks.push(chunk.slice(-2));
          }
        }
        // 通过fileReader把blob加入到spark
        const fileReader = new FileReader();
        const spark = new sparkMD5.ArrayBuffer();
        fileReader.readAsArrayBuffer(new Blob(tempChunks));
        fileReader.onload = () => {
          spark.append(fileReader.result);
          resolve(spark.end());
        };
      });
    },
    async uploadFile() {
      if (!this.file) {
        return;
      }

      // 判断图片格式
      if (!(await this.isImage(this.file))) {
        this.$message.warning("请选择图片");
        return;
      }
      // 切片
      const chunks = await this.createFileChunks(this.file);
      // 计算hash
      const hash = await this.calculateHashWorker(chunks);
      //   const hash2 = await this.calculateHashIdle(chunks);
      //   const hash3 = await this.calculateHashSample(chunks);
      // 检查文件是否已经上传
      const { uploaded, uploadList } = await this.checkFile();
      if (uploaded) {
        this.$message.success("秒传成功");
        return;
      }

      this.hash = hash;
      this.chunks = chunks.map((chunk, index) => {
        const name = `${hash}_${index}`;
        return {
          name,
          hash,
          index,
          chunk: chunk.chunk,
          progress: 0,
        };
      });
      await this.uploadChunks(uploadList);
      await this.mergeRequest();
    },
    async checkFile() {
      const ret = await this.$http.get(
        `/checkfile?hash=${this.hash}&ext=${this.ext}`
      );
      return ret.data;
    },
    async uploadChunks(uploadList) {
      const chunks = this.chunks;
      // return new Promise(resolve => {
      const requests = chunks
        .map((chunk) => {
          if (uploadList.includes(chunk.name)) {
            chunk.progress = 100;
          }
          return chunk;
        })
        .filter((chunk) => chunk.progress !== 100)
        .map((chunk) => {
          const formData = new FormData();
          formData.append("chunk", chunk.chunk);
          formData.append("name", chunk.name);
          formData.append("hash", chunk.hash);
          return { formData, chunk };
        });
      await this.sendRequests(requests);
    },
    async sendRequests(tasks, limit = 4) {
      return new Promise((resolve, reject) => {
        let isStop = false;
        const len = tasks.length;
        let count = 0;
        const next = async () => {
          if (isStop) {
            return;
          }
          const task = tasks.shift();
          if (task) {
            task.error = task.error || 0;
            const { chunk, formData } = task;
            try {
              await this.$http.post("/uploadChunk", formData, {
                onUploadProgress: (progressEvent) => {
                  let complete =
                    ((progressEvent.loaded / progressEvent.total) * 100) | 0;
                  chunk.progress = complete;
                },
              });
              count++;
              if (count < len) {
                next();
              } else {
                resolve();
              }
            } catch (e) {
              // 显示错误
              chunk.progress = -1;
              if (task.error < 3) {
                task.error++;
                tasks.unshift(task);
                next();
              } else {
                isStop = true;
                reject();
              }
            }
          }
        };
        while (limit > 0) {
          next();
          limit--;
        }
      });
    },
    async mergeRequest() {
      await this.$http.post("/mergefile", {
        hash: this.hash,
        ext: this.ext,
        size: CHUNK_SIZE,
      });
    },
  },
};
</script>

<style lang="stylus">
#drag {
  height: 100px;
  line-height: 100px;
  border: 2px dashed #eee;
  text-align: center;
}

.cube-container {
  .cube {
    width: 14px;
    height: 14px;
    line-height: 12px;
    border: 1px black solid;
    background: #eee;
    float: left;

    >.success {
      background: green;
    }

    >.uploading {
      background: blue;
    }

    >.error {
      background: red;
    }
  }
}
</style>