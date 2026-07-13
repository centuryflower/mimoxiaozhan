const crypto = require('crypto');
const config = require('./config');

// ========== 易支付签名 ==========

function epaySign(params, key) {
  const sorted = Object.keys(params).filter(k => k !== 'sign' && k !== 'sign_type' && params[k] !== '').sort();
  const str = sorted.map(k => `${k}=${params[k]}`).join('&') + key;
  return crypto.createHash('md5').update(str).digest('hex');
}

function epayVerify(params, key) {
  const sign = params.sign;
  return epaySign(params, key) === sign;
}

// 创建易支付订单
function createEpayOrder(order) {
  const epay = config.payment.epay;
  const params = {
    pid: epay.pid,
    type: order.paymentMethod === 'wechat' ? 'wxpay' : 'alipay',
    out_trade_no: order.tradeNo,
    notify_url: `${getBaseUrl()}/api/payment/notify`,
    return_url: `${getBaseUrl()}/order/${order.id}`,
    name: order.productName,
    money: order.totalPrice.toFixed(2)
  };
  params.sign = epaySign(params, epay.key);
  params.sign_type = 'MD5';

  const query = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return `${epay.url}/submit.php?${query}`;
}

// 易支付异步回调验证
function verifyEpayCallback(query) {
  const epay = config.payment.epay;
  if (!epayVerify(query, epay.key)) return false;
  return query.trade_status === 'TRADE_SUCCESS';
}

// ========== 工具函数 ==========

function getBaseUrl() {
  return config.site.baseUrl || `http://localhost:${config.port}`;
}

// 获取支付方式配置
function getPaymentMethods() {
  const methods = [];
  const epay = config.payment.epay;
  const qr = config.payment.qrcode;

  if (epay.enabled && epay.url) {
    methods.push({ id: 'wechat', name: '微信支付', icon: 'wechat', type: 'epay' });
    methods.push({ id: 'alipay', name: '支付宝', icon: 'alipay', type: 'epay' });
  }

  if (qr.enabled) {
    if (qr.wechat) methods.push({ id: 'wechat_qr', name: '微信扫码', icon: 'wechat', type: 'qrcode' });
    if (qr.alipay) methods.push({ id: 'alipay_qr', name: '支付宝扫码', icon: 'alipay', type: 'qrcode' });
  }

  // 至少提供手动扫码选项
  if (methods.length === 0) {
    methods.push({ id: 'manual', name: '扫码支付', icon: 'qrcode', type: 'qrcode' });
  }

  return methods;
}

module.exports = {
  epaySign, epayVerify, createEpayOrder, verifyEpayCallback,
  getPaymentMethods, getBaseUrl
};
