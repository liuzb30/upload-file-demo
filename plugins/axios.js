import Vue from 'vue'
import axios from 'axios'
let service = axios.create({
  // 前缀
  baseURL:'/api'
})

Vue.prototype.$http =service

export const http = service