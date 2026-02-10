# 禁漫下载器网页版
要求：在网页输入车牌号，用户可以下载到对应本子的PDF文件，支持可选的PDF密码。
## 技术架构
分为部署为Cloudflare Pages的React前端和部署为Cloudflare Worker的后端。
### 后端
一个Cloudflare Worker，负责与禁漫服务器通信获取本子内容，解密相关数据，传输给客户端。
抄袭JMComic-Crawler-Python中以客户端API方式与禁漫通信的代码，获取图片URL，`photoId`和`scrambleId`。
考虑到前端网络条件的不确定性，将每张图片编码为base64，加上解密数据打包为json，通过sse传到客户端。
### 前端
使用React构建，负责与后端通信，获取上述数据解码，算出切片数量，使用`Photon.js`切割拼接来解密。
使用`MuPDF.js`将解密的图片拼接为PDF。支持可选的密码设置。
变为文件下载给用户。
