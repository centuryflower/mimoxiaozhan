module.exports = {
  // 服务器
  port: 3000,
  host: '0.0.0.0',

  // 管理后台
  admin: {
    username: 'admin',
    password: 'admin123', // ⚠️ 部署后务必修改
    sessionSecret: 'change-this-to-random-string'
  },

  // 站点信息
  site: {
    name: '自动发卡',
    description: '会员账号自动发货平台',
    logo: '',
    notice: '购买后卡密自动发送，请勿重复下单。'
  },

  // 支付配置
  payment: {
    // 易支付接口（支持微信/支付宝）
    epay: {
      enabled: false,
      url: '',        // 易支付网关地址
      pid: '',        // 商户ID
      key: '',        // 商户密钥
    },
    // 当面付（个人收款码）
    qrcode: {
      enabled: true,
      wechat: '',     // 微信收款码图片路径
      alipay: '',     // 支付宝收款码图片路径
    }
  },

  // 数据文件路径
  dataDir: './data'
};
