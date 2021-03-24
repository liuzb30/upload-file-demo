<template>
  <div>
      <div  id="drag">
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
  </div>
</template>

<script>
export default {
  data(){
    return{
      uploadProgress:0
    }
  },
  methods:{
    handleFileChange(e){
      this.file = e.target.files[0]
    },
    async uploadFile(){
      if(!this.file){return}
      const formData =  new FormData()
      formData.append('file', this.file)
      formData.append('name', this.file.name)
      //发起请求
      const ret = await this.$http.post('/uploadfile', formData)
      console.log(ret);
    }
  }
}
</script>

<style lang="stylus">
#drag
  height 100px
  line-height 100px
  border 2px dashed #eee
  text-align center

</style>