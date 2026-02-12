# 禁漫下载器网页版
在网页输入车牌号，用户可以下载到对应本子的PDF文件。
## 部署与开发
```sh
git clone https://github.com/TunaFish2K/jmcomic-downloader-web --depth=1
cd jmcomic-downloader-web
```
### 后端
```sh
pnpm run worker:dev # 开发
pnpm run worker:deploy # 部署
```
### 前端
```sh
pnpm run dev # 自动启动后端与前端
```
在部署后端后，需要你在Github Fork这一仓库。  
在Cloudflare面板创建Page，使用这一仓库。  
将根目录设置为`/page`，框架预设选择React，构建命令填写`pnpm run build`。  
设置环境变量`VITE_BACKEND_URL`为Worker的地址。然后部署。

## 技术架构
分为部署为Cloudflare Pages的React前端和部署为Cloudflare Worker的后端。
### 后端
一个Cloudflare Worker，负责与禁漫服务器通信获取本子内容，解密相关数据，传输给客户端。
抄袭JMComic-Crawler-Python中以客户端API方式与禁漫通信的代码，获取图片URL，`photoId`和`scrambleId`。
将这些数据发给客户端。
### 前端
使用React构建，负责与后端通信，获取上述数据解码，算出切片数量，使用切割拼接来解密。
将解密的图片拼接为PDF。变为文件下载给用户。
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
- [x] 实现后端接口
    - [x] 提供车牌号，标题，标签，图片链接，`scrambleId`
- [x] 实现前端
    - [x] 与后端通信的接口
    - [x] 根据图片数据解密图片
        - [x] 计算切片数量的算法
        - [x] 用offscreen canvas重新拼接（web worker毙掉了）
    - [x] 实现生成PDF功能（密码功能毙掉了）
    - [x] 用户界面与上述代码的对接
        - [x] 表单1，负责填写车牌号，执行查询
        - [x] 表单2，表单1成功查询的情况下，提供下载并生成pdf的按钮
    - [x] 界面美化
- [x] 修缮
    - [x] 后端限流（借助cloudflare waf，不用自行实现）
    - [x] 前端下载图片的进度显示
    - [ ] 支持以CBZ格式或ZIP格式（内容一样）下载
        - [x] 引入zip模块
        - [x] 文件的打包
            - [x] 图片内容
            - [x] ComicInfo.xml的生成
        - [x] 选择导出方式的ui
    - [x] 加入提示不支持动图（不计划实现），实现跳过动图的功能
## 致谢
本项目全程在学习和抄写[https://github.com/hect0x7/JMComic-Crawler-Python](https://github.com/hect0x7/JMComic-Crawler-Python/)项目。（欸嘿）

## 许可证
本项目以MIT许可证开源。
