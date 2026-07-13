// ========== 发卡平台前端 ==========

let currentProduct = null;
let currentOrder = null;
let paymentMethods = [];

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  loadProducts();
  loadPaymentMethods();
});

// Toast 提示
function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

// 加载商品
async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    const products = await res.json();
    const container = document.getElementById('products');

    if (products.length === 0) {
      container.innerHTML = '<div class="empty">暂无商品</div>';
      return;
    }

    container.innerHTML = products.map(p => `
      <div class="product-card" onclick="openBuy('${p.id}')">
        <div class="product-header">
          <div class="product-name">${esc(p.name)}</div>
          <span class="product-tag">${esc(p.category)}</span>
        </div>
        <div class="product-desc">${esc(p.description)}</div>
        <div class="product-footer">
          <div class="product-price">${p.price.toFixed(2)}</div>
          <div class="product-stock ${p.stock === 0 ? 'out' : p.stock < 5 ? 'low' : ''}">
            ${p.stock === 0 ? '已售罄' : '库存 ' + p.stock}
          </div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    document.getElementById('products').innerHTML = '<div class="empty">加载失败，请刷新重试</div>';
  }
}

// 加载支付方式
async function loadPaymentMethods() {
  try {
    const res = await fetch('/api/payment/methods');
    paymentMethods = await res.json();
  } catch (e) {
    paymentMethods = [{ id: 'manual', name: '扫码支付', icon: 'qrcode', type: 'qrcode' }];
  }
}

// 打开购买弹窗
function openBuy(productId) {
  fetch('/api/products')
    .then(r => r.json())
    .then(products => {
      currentProduct = products.find(p => p.id === productId);
      if (!currentProduct) return toast('商品不存在');
      if (currentProduct.stock === 0) return toast('该商品已售罄');

      document.getElementById('buy-product-name').textContent = currentProduct.name;
      document.getElementById('buy-product-price').textContent = currentProduct.price.toFixed(2);
      document.getElementById('buy-quantity').value = 1;
      document.getElementById('buy-quantity').max = currentProduct.stock;
      updateTotal();

      // 渲染支付方式
      const pmContainer = document.getElementById('payment-methods');
      pmContainer.innerHTML = paymentMethods.map((m, i) => `
        <div class="pay-method ${i === 0 ? 'selected' : ''}" data-id="${m.id}" onclick="selectPayment(this)">
          <span class="icon-${m.icon}">${getPayIcon(m.icon)}</span>
          <span>${m.name}</span>
        </div>
      `).join('');

      document.getElementById('buy-modal').classList.add('show');
    });
}

function getPayIcon(type) {
  const icons = {
    wechat: '💚',
    alipay: '🔵',
    qrcode: '📱'
  };
  return icons[type] || '📱';
}

function selectPayment(el) {
  document.querySelectorAll('.pay-method').forEach(m => m.classList.remove('selected'));
  el.classList.add('selected');
}

function getSelectedPayment() {
  const el = document.querySelector('.pay-method.selected');
  return el ? el.dataset.id : 'manual';
}

function updateTotal() {
  if (!currentProduct) return;
  const qty = parseInt(document.getElementById('buy-quantity').value) || 1;
  const total = currentProduct.price * qty;
  document.getElementById('buy-total-price').textContent = total.toFixed(2);
}

// 监听数量变化
document.getElementById('buy-quantity').addEventListener('input', updateTotal);

// 提交订单
async function submitOrder() {
  const email = document.getElementById('buy-email').value.trim();
  const quantity = parseInt(document.getElementById('buy-quantity').value) || 1;
  const paymentMethod = getSelectedPayment();

  if (!email) return toast('请填写邮箱');
  if (!/^\S+@\S+\.\S+$/.test(email)) return toast('邮箱格式不正确');

  document.getElementById('btn-pay').disabled = true;
  document.getElementById('btn-pay').textContent = '提交中...';

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: currentProduct.id,
        quantity,
        email,
        paymentMethod
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '下单失败');

    currentOrder = data.order;
    closeModal();

    // 显示支付弹窗
    showPayModal(data.order, data.payUrl);
  } catch (e) {
    toast(e.message);
  } finally {
    document.getElementById('btn-pay').disabled = false;
    document.getElementById('btn-pay').textContent = '立即支付';
  }
}

// 显示支付弹窗
function showPayModal(order, payUrl) {
  document.getElementById('pay-amount').textContent = order.totalPrice.toFixed(2);
  document.getElementById('pay-trade-no').textContent = order.tradeNo;

  const qrContainer = document.getElementById('pay-qrcode');
  qrContainer.innerHTML = '';

  if (payUrl) {
    // 易支付跳转
    qrContainer.innerHTML = `
      <p style="margin-bottom:1rem;font-size:0.9rem;">正在跳转到支付页面...</p>
      <a href="${esc(payUrl)}" class="btn btn-primary" target="_blank">点击支付</a>
    `;
    window.open(payUrl, '_blank');
  } else {
    // 显示收款二维码
    const method = getSelectedPayment();
    const pm = paymentMethods.find(m => m.id === method);
    let qrImg = '';

    if (method.includes('wechat') || method === 'manual') {
      // 微信收款码 — 这里用占位，实际配置后显示
      qrImg = '/uploads/wechat-qr.png';
    } else if (method.includes('alipay')) {
      qrImg = '/uploads/alipay-qr.png';
    }

    if (qrImg) {
      qrContainer.innerHTML = `<img src="${qrImg}" alt="收款码" style="width:200px;height:200px;object-fit:contain;">`;
    } else {
      qrContainer.innerHTML = `<p style="color:var(--text-3);">请先在后台配置收款码</p>`;
    }
  }

  document.getElementById('pay-modal').classList.add('show');

  // 轮询订单状态
  startPolling(order.id);
}

// 轮询支付状态
let pollTimer = null;

function startPolling(orderId) {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      const order = await res.json();
      if (order.status === 'completed') {
        clearInterval(pollTimer);
        closePayModal();
        showResult(order);
      }
    } catch (e) {}
  }, 3000);
}

async function checkPayStatus() {
  if (!currentOrder) return;
  try {
    const res = await fetch(`/api/orders/${currentOrder.id}`);
    const order = await res.json();
    if (order.status === 'completed') {
      if (pollTimer) clearInterval(pollTimer);
      closePayModal();
      showResult(order);
    } else {
      toast('尚未检测到支付，请稍后再试');
    }
  } catch (e) {
    toast('查询失败');
  }
}

function showResult(order) {
  const cardHtml = order.cards.map(c => `<div class="card-content">${esc(c)}</div>`).join('');
  document.querySelector('.query-result') ?
    document.querySelector('.query-result').innerHTML = buildOrderHTML(order) :
    null;

  // 简单弹窗显示
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay show';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">🎉 购买成功</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div class="modal-body">
        <p style="margin-bottom:1rem;color:var(--success);font-weight:600;">卡密已发放：</p>
        ${cardHtml}
        <p style="margin-top:1rem;font-size:0.8rem;color:var(--text-3);">
          订单号：${order.tradeNo} · 请妥善保存卡密
        </p>
        <button class="btn btn-primary btn-block" style="margin-top:1rem" onclick="this.closest('.modal-overlay').remove()">确定</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

// 关闭弹窗
function closeModal() {
  document.getElementById('buy-modal').classList.remove('show');
}

function closePayModal() {
  document.getElementById('pay-modal').classList.remove('show');
  if (pollTimer) clearInterval(pollTimer);
}

// 点击遮罩关闭
document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', (e) => {
    if (e.target === el) {
      el.classList.remove('show');
      if (pollTimer) clearInterval(pollTimer);
    }
  });
});

// HTML 转义
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
