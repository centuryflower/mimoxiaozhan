const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const db = require('./db');
const payment = require('./payment');
const multer = require('multer');

const app = express();

// ========== 中间件 ==========

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: config.admin.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// 静态文件
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 文件上传
const upload = multer({
  dest: path.join(__dirname, 'uploads'),
  limits: { fileSize: 2 * 1024 * 1024 }
});

// 管理后台鉴权
function requireAdmin(req, res, next) {
  if (req.session.isAdmin) return next();
  res.status(401).json({ error: '未登录' });
}

// ========== 前台 API ==========

// 获取商品列表
app.get('/api/products', (req, res) => {
  const products = db.getProducts().filter(p => p.enabled);
  res.json(products);
});

// 获取支付方式
app.get('/api/payment/methods', (req, res) => {
  res.json(payment.getPaymentMethods());
});

// 创建订单
app.post('/api/orders', (req, res) => {
  const { productId, quantity, email, contact, paymentMethod } = req.body;
  const product = db.getProduct(productId);
  if (!product || !product.enabled) return res.status(400).json({ error: '商品不存在' });
  if (product.stock < (quantity || 1)) return res.status(400).json({ error: '库存不足' });

  const order = db.createOrder({
    productId, productName: product.name, price: product.price,
    quantity, email, contact, paymentMethod, ip: req.ip
  });

  // 生成支付链接或二维码
  let payUrl = null;
  const method = payment.getPaymentMethods().find(m => m.id === paymentMethod);

  if (method && method.type === 'epay') {
    payUrl = payment.createEpayOrder(order);
  }

  res.json({ order, payUrl });
});

// 查询订单
app.get('/api/orders/:id', (req, res) => {
  const order = db.getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: '订单不存在' });
  res.json(order);
});

// 查询订单（通过订单号）
app.get('/api/orders/trade/:tradeNo', (req, res) => {
  const order = db.getOrderByTradeNo(req.params.tradeNo);
  if (!order) return res.status(404).json({ error: '订单不存在' });
  res.json(order);
});

// 支付回调（易支付）
app.post('/api/payment/notify', (req, res) => {
  if (!payment.verifyEpayCallback(req.body)) {
    return res.send('fail');
  }
  const order = db.getOrderByTradeNo(req.body.out_trade_no);
  if (!order) return res.send('fail');

  // 完成支付
  db.payOrder(order.id);

  // 自动发卡
  const card = db.sellCard(order.productId, order.id);
  if (card) {
    db.completeOrder(order.id, card.content);
  }

  res.send('success');
});

// 手动确认支付（用于扫码支付场景，需要管理员操作或对接回调）
app.post('/api/orders/:id/confirm', (req, res) => {
  const order = db.getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: '订单不存在' });
  if (order.status !== 'pending') return res.status(400).json({ error: '订单状态异常' });

  db.payOrder(order.id);
  const card = db.sellCard(order.productId, order.id);
  if (card) {
    db.completeOrder(order.id, card.content);
    res.json({ status: 'completed', card: card.content });
  } else {
    res.json({ status: 'paid', message: '已支付，但库存不足，请联系客服' });
  }
});

// ========== 管理后台 API ==========

// 登录
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === config.admin.username && password === config.admin.password) {
    req.session.isAdmin = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: '用户名或密码错误' });
  }
});

// 登出
app.post('/api/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// 统计
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  res.json(db.getStats());
});

// 商品管理
app.get('/api/admin/products', requireAdmin, (req, res) => {
  res.json(db.getProducts());
});

app.post('/api/admin/products', requireAdmin, (req, res) => {
  const product = db.createProduct(req.body);
  res.json(product);
});

app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  const product = db.updateProduct(req.params.id, req.body);
  if (!product) return res.status(404).json({ error: '商品不存在' });
  res.json(product);
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  db.deleteProduct(req.params.id);
  res.json({ success: true });
});

// 卡密管理
app.get('/api/admin/cards/:productId', requireAdmin, (req, res) => {
  res.json(db.getCards(req.params.productId));
});

app.post('/api/admin/cards/:productId', requireAdmin, (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: '卡密内容不能为空' });
  const count = db.addCards(req.params.productId, content);
  res.json({ added: count });
});

// 订单管理
app.get('/api/admin/orders', requireAdmin, (req, res) => {
  const orders = db.getOrders().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(orders);
});

app.post('/api/admin/orders/:id/confirm', requireAdmin, (req, res) => {
  const order = db.getOrder(req.params.id);
  if (!order) return res.status(404).json({ error: '订单不存在' });
  if (order.status !== 'pending') return res.status(400).json({ error: '订单状态异常' });

  db.payOrder(order.id);
  const card = db.sellCard(order.productId, order.id);
  if (card) {
    db.completeOrder(order.id, card.content);
    res.json({ status: 'completed', card: card.content });
  } else {
    res.json({ status: 'paid', message: '已支付，无库存' });
  }
});

app.post('/api/admin/orders/:id/expire', requireAdmin, (req, res) => {
  db.expireOrder(req.params.id);
  res.json({ success: true });
});

// 上传收款码
app.post('/api/admin/upload', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '没有文件' });
  const ext = path.extname(req.file.originalname);
  const newName = req.file.filename + ext;
  fs.renameSync(req.file.path, path.join(__dirname, 'uploads', newName));
  res.json({ url: `/uploads/${newName}` });
});

// ========== 页面路由 ==========

// 前台页面
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/order/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'order.html')));
app.get('/query', (req, res) => res.sendFile(path.join(__dirname, 'public', 'query.html')));

// 管理后台
app.get('/admin', (req, res) => res.sendFile('admin.html', { root: path.join(__dirname, 'public') }));

// ========== 启动 ==========

app.listen(config.port, config.host, () => {
  console.log(`🚀 发卡平台已启动: http://localhost:${config.port}`);
  console.log(`📦 管理后台: http://localhost:${config.port}/admin`);
  console.log(`🔑 默认账号: ${config.admin.username} / ${config.admin.password}`);
});
