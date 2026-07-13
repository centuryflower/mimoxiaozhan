# ⚡ 自动发卡平台

轻量级自动发卡平台，支持微信/支付宝支付，卡密自动发货。

## 功能

- 📦 商品管理（添加/编辑/删除）
- 🔑 卡密管理（批量导入/自动发货）
- 💰 支持微信 & 支付宝（易支付/扫码支付）
- 📋 订单管理（查看/确认/作废）
- 📊 数据统计（今日订单/收入/库存）
- 🔍 订单查询（买家自助查单）

## 快速开始

```bash
# 安装依赖
npm install

# 启动
npm start
```

访问 http://localhost:3000 进入前台
访问 http://localhost:3000/admin 进入后台（默认账号 admin / admin123）

## 配置

编辑 `config.js`：

```js
// 修改管理员密码
admin: {
  password: 'your-new-password'
}

// 配置支付（易支付）
payment: {
  epay: {
    enabled: true,
    url: 'https://pay.example.com',
    pid: 'your-pid',
    key: 'your-key'
  }
}

// 或配置收款码
payment: {
  qrcode: {
    enabled: true,
    wechat: '/uploads/wechat-qr.png',
    alipay: '/uploads/alipay-qr.png'
  }
}
```

## 部署

### 服务器部署

```bash
# 使用 PM2
npm install -g pm2
pm2 start server.js --name faka
pm2 save
```

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install --production
EXPOSE 3000
CMD ["node", "server.js"]
```

## 技术栈

- Node.js + Express 5
- JSON 文件存储（无需数据库）
- 前端原生 HTML/CSS/JS（无框架依赖）
