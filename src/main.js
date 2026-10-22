import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// 👇 这是新增的 Vercel 统计代码 👇
import { inject } from '@vercel/analytics'
inject()
// 👆 这是新增的 Vercel 统计代码 👆

// 如果你原来有引入 pinia 或其他 css，请保留它们，例如：
// import { createPinia } from 'pinia'
// import './style.css'

const app = createApp(App)

// 如果你原来有 app.use(createPinia())，请保留
app.use(router)

app.mount('#app')