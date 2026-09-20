import { createApp, vaporInteropPlugin } from 'vue'
import App from './App.vue'
import './index.css'

const app = createApp(App)

// `App` and the components inside of it are compiled in Vapor Mode while the
// root is mounted as a vdom app, so the Vapor <-> vdom interop plugin is required.
app.use(vaporInteropPlugin)

app.mount('#app')
