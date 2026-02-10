# 禁漫下载器网页版
要求：在网页输入车牌号，用户可以下载到对应本子的PDF文件，支持可选的PDF密码。
## 技术架构
分为部署为Cloudflare Pages的React前端和部署为Cloudflare Worker的后端。
### 后端
一个Cloudflare Worker，负责与禁漫服务器通信获取本子内容，解密相关数据，传输给客户端。
抄袭JMComic-Crawler-Python中以客户端API方式与禁漫通信的代码，获取图片URL，`photoId`和`scrambleId`。
将这些数据发给客户端。
### 前端
使用React构建，负责与后端通信，获取上述数据解码，算出切片数量，使用切割拼接来解密。
将解密的图片拼接为PDF。支持可选的密码设置。
变为文件下载给用户。
## 开发阶段
- [x] 实现与禁漫服务器的通信
    - [x] 实现请求时参数的生成
        - [x] token相关
        - [x] 默认cookie
            - [x] 使用`set-cookie-parser`解析传来的Set-Cookie
            - [x] 生成默认cookie的头数据
    - [x] 实现通用的返回数据解密
    - [x] 实现可用域名的动态获取
    - [x] 实现获取章节的数据（标题，图片列表，scrambleId）
        - [x] 获取数据
        - [x] 获取scrambleId
- [ ] 实现后端接口
- [ ] 实现前端
    - [ ] 从后端得到图片
    - [ ] 根据图片数据解密图片
    - [ ] 实现可选密码的生成PDF功能
    - [ ] 用户界面与上述代码的对接
