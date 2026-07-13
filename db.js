const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

const dataDir = path.resolve(__dirname, config.dataDir);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

function readJSON(file) {
  const fp = path.join(dataDir, file);
  if (!fs.existsSync(fp)) return [];
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

function writeJSON(file, data) {
  fs.writeFileSync(path.join(dataDir, file), JSON.stringify(data, null, 2));
}

// ========== 商品 ==========

function getProducts() {
  return readJSON('products.json').filter(p => !p.deleted);
}

function getProduct(id) {
  return readJSON('products.json').find(p => p.id === id && !p.deleted);
}

function createProduct(data) {
  const products = readJSON('products.json');
  const product = {
    id: crypto.randomUUID(),
    name: data.name,
    description: data.description || '',
    price: Number(data.price),
    category: data.category || '默认',
    stock: 0,
    sales: 0,
    enabled: true,
    deleted: false,
    sortOrder: products.length,
    createdAt: new Date().toISOString()
  };
  products.push(product);
  writeJSON('products.json', products);
  return product;
}

function updateProduct(id, data) {
  const products = readJSON('products.json');
  const idx = products.findIndex(p => p.id === id);
  if (idx === -1) return null;
  Object.assign(products[idx], data, { updatedAt: new Date().toISOString() });
  writeJSON('products.json', products);
  return products[idx];
}

function deleteProduct(id) {
  return updateProduct(id, { deleted: true });
}

// ========== 卡密 ==========

function getCards(productId) {
  return readJSON('cards.json').filter(c => c.productId === productId);
}

function getAvailableCards(productId) {
  return readJSON('cards.json').filter(c => c.productId === productId && !c.sold);
}

function addCards(productId, content) {
  const cards = readJSON('cards.json');
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  const newCards = lines.map(line => ({
    id: crypto.randomUUID(),
    productId,
    content: line,
    sold: false,
    orderId: null,
    createdAt: new Date().toISOString()
  }));
  cards.push(...newCards);
  writeJSON('cards.json', cards);
  // 更新库存数
  updateProductStock(productId);
  return newCards.length;
}

function updateProductStock(productId) {
  const available = getAvailableCards(productId);
  const products = readJSON('products.json');
  const idx = products.findIndex(p => p.id === productId);
  if (idx !== -1) {
    products[idx].stock = available.length;
    writeJSON('products.json', products);
  }
}

function sellCard(productId, orderId) {
  const cards = readJSON('cards.json');
  const idx = cards.findIndex(c => c.productId === productId && !c.sold);
  if (idx === -1) return null;
  cards[idx].sold = true;
  cards[idx].orderId = orderId;
  cards[idx].soldAt = new Date().toISOString();
  writeJSON('cards.json', cards);
  updateProductStock(productId);
  return cards[idx];
}

// ========== 订单 ==========

function getOrders() {
  return readJSON('orders.json');
}

function getOrder(id) {
  return readJSON('orders.json').find(o => o.id === id);
}

function getOrderByTradeNo(tradeNo) {
  return readJSON('orders.json').find(o => o.tradeNo === tradeNo);
}

function createOrder(data) {
  const orders = readJSON('orders.json');
  const order = {
    id: crypto.randomUUID(),
    tradeNo: 'FK' + Date.now() + Math.random().toString(36).slice(2, 6).toUpperCase(),
    productId: data.productId,
    productName: data.productName,
    price: Number(data.price),
    quantity: Number(data.quantity) || 1,
    totalPrice: Number(data.price) * (Number(data.quantity) || 1),
    email: data.email || '',
    contact: data.contact || '',
    paymentMethod: data.paymentMethod || 'qrcode',
    status: 'pending',   // pending / paid / completed / expired
    cards: [],
    ip: data.ip || '',
    createdAt: new Date().toISOString(),
    paidAt: null,
    completedAt: null
  };
  orders.push(order);
  writeJSON('orders.json', orders);
  return order;
}

function payOrder(id) {
  const orders = readJSON('orders.json');
  const idx = orders.findIndex(o => o.id === id);
  if (idx === -1) return null;
  orders[idx].status = 'paid';
  orders[idx].paidAt = new Date().toISOString();
  writeJSON('orders.json', orders);
  return orders[idx];
}

function completeOrder(id, cardContent) {
  const orders = readJSON('orders.json');
  const idx = orders.findIndex(o => o.id === id);
  if (idx === -1) return null;
  orders[idx].status = 'completed';
  orders[idx].cards.push(cardContent);
  orders[idx].completedAt = new Date().toISOString();
  // 更新销量
  const products = readJSON('products.json');
  const pIdx = products.findIndex(p => p.id === orders[idx].productId);
  if (pIdx !== -1) {
    products[pIdx].sales = (products[pIdx].sales || 0) + 1;
    writeJSON('products.json', products);
  }
  writeJSON('orders.json', orders);
  return orders[idx];
}

function expireOrder(id) {
  const orders = readJSON('orders.json');
  const idx = orders.findIndex(o => o.id === id);
  if (idx === -1) return null;
  orders[idx].status = 'expired';
  writeJSON('orders.json', orders);
  return orders[idx];
}

// ========== 统计 ==========

function getStats() {
  const orders = getOrders();
  const products = getProducts();
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter(o => o.createdAt.startsWith(today));
  return {
    totalOrders: orders.length,
    todayOrders: todayOrders.length,
    totalRevenue: orders.filter(o => o.status === 'completed').reduce((s, o) => s + o.totalPrice, 0),
    todayRevenue: todayOrders.filter(o => o.status === 'completed').reduce((s, o) => s + o.totalPrice, 0),
    totalProducts: products.length,
    pendingOrders: orders.filter(o => o.status === 'pending').length
  };
}

module.exports = {
  getProducts, getProduct, createProduct, updateProduct, deleteProduct,
  getCards, getAvailableCards, addCards,
  getOrders, getOrder, getOrderByTradeNo, createOrder, payOrder, completeOrder, expireOrder,
  getStats
};
