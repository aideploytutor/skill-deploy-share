/**
 * warehouse-site (episode 015): everything about YOUR warehouse lives in this file.
 * Change the words, numbers, services and prices here; every page reads from it.
 * The numbers and prices below are EXAMPLES: replace them with your own before going live.
 */

export type Lang = "zh" | "en";
export type Text = Record<Lang, string>;
export type IconName = "box" | "truck" | "return" | "tag" | "home" | "check";

export const warehouse = {
  /** Shown in the header and emails. NEXT_PUBLIC_SITE_NAME overrides it. */
  name: process.env.NEXT_PUBLIC_SITE_NAME || "Demo 3PL",
  badge: { zh: "美国本土海外仓 · 洛杉矶 Ontario, CA", en: "US fulfillment center · Ontario, CA (LA)" } as Text,
  heroLine1: { zh: "当天入库，当天发货", en: "Received today. Shipped today." } as Text,
  heroLine2: { zh: "你的美国仓，像大仓一样省心", en: "A US warehouse that runs like the big ones" } as Text,
  intro: {
    zh: "一件代发、FBA 中转、退货处理。华人团队中文对接，库存、订单和账单在客户后台随时查，不用再一条条问微信。",
    en: "Dropshipping, FBA prep and returns. A Chinese-speaking team, with inventory, orders and bills in your own client portal, no more chasing on WeChat.",
  } as Text,
  platforms: ["Amazon", "TikTok Shop", "Temu", "Shopify", "Walmart", "SHEIN"],
  /** Proof numbers under the hero. Only show what's true for your warehouse. */
  stats: [
    { value: "50,000", label: { zh: "平方英尺仓储面积", en: "sq ft of storage" } },
    { value: "16:00", label: { zh: "前下单当天发货（美西）", en: "same-day cut-off (PT)" } },
    { value: "99.8%", label: { zh: "发货准确率", en: "order accuracy" } },
    { value: "40 min", label: { zh: "车程到长滩港", en: "drive to Long Beach port" } },
  ],
  services: [
    { icon: "box" as IconName, title: { zh: "一件代发", en: "Dropshipping" }, body: { zh: "TikTok Shop、Temu、Shopify、亚马逊自发货订单，当天拣货打包。", en: "TikTok Shop, Temu, Shopify and Amazon MFN orders picked and packed the same day." } },
    { icon: "truck" as IconName, title: { zh: "FBA / WFS 中转", en: "FBA / WFS prep" }, body: { zh: "换标、贴箱唛、打托，按亚马逊和沃尔玛要求补货入仓。", en: "Relabel, carton labels and pallets, sent to Amazon or Walmart to spec." } },
    { icon: "return" as IconName, title: { zh: "退货处理", en: "Returns" }, body: { zh: "拆检、拍照、重新上架或销毁，每一件都有记录可查。", en: "Inspect, photograph, restock or dispose, every item logged." } },
    { icon: "tag" as IconName, title: { zh: "快递面单", en: "Shipping labels" }, body: { zh: "USPS / UPS / FedEx 协议价，也可以用你自己的快递账号。", en: "Discounted USPS / UPS / FedEx rates, or bring your own account." } },
  ],
  steps: [
    { title: { zh: "在线开户", en: "Open an account" }, body: { zh: "网上填资料，审核通过就能登录客户后台。", en: "Apply online; once approved, log in to your portal." } },
    { title: { zh: "提交入库预报", en: "Send an inbound notice" }, body: { zh: "货还在海上就告诉我们 SKU 和箱数，到仓当天上架。", en: "Tell us SKUs and cartons while it's at sea; shelved the day it lands." } },
    { title: { zh: "订单自动进仓", en: "Orders flow in" }, body: { zh: "后台下单、Excel 批量导入或店铺对接，发货后单号自动回传。", en: "Create, upload a spreadsheet or connect your store; tracking comes back automatically." } },
    { title: { zh: "月底一张账单", en: "One bill a month" }, body: { zh: "每笔费用都有明细，信用卡或银行转账在线付清。", en: "Every fee itemized, paid online by card or bank transfer." } },
  ],
  location: {
    city: { zh: "加州 Ontario，洛杉矶东", en: "Ontario, California, east of LA" } as Text,
    note: { zh: "靠近洛杉矶和长滩港，美西 2–3 天送达。欢迎预约来仓库看看。", en: "Close to the LA and Long Beach ports, 2–3 days across the West. Visits welcome." } as Text,
    address: "[Your warehouse address]",
  },
  /** Example rate card (USD). The quote calculator uses exactly these numbers. */
  rates: {
    receivingPerUnit: 0.25, // 入库上架 per unit
    storagePerCubicFootMonth: 0.6, // 仓储 per cubic foot per month
    pickFirstItem: 1.0, // 一件代发 first item in an order
    pickExtraItem: 0.3, // each extra item in the same order
    oversizePerOrder: 2.5, // 大件附加 when a unit is over the limits below
    oversizeWeightLb: 50,
    oversizeLongestIn: 48,
    minimumMonthly: 0, // set e.g. 100 for a monthly minimum
  },
  contact: {
    /** Shown on the site. Inquiries are emailed to WAREHOUSE_INBOX_EMAIL (set in the host). */
    wechat: "demo3pl", // put your real WeChat ID
    phone: "",
    hours: { zh: "周一至周五 9:00–18:00（美西）", en: "Mon–Fri 9am–6pm PT" } as Text,
  },
};

export const platformOptions = ["Amazon", "TikTok Shop", "Temu", "Shopify", "Walmart", "SHEIN", "eBay", "Other"];
export const orderRanges = ["< 300", "300–1,000", "1,000–5,000", "5,000+"];

/** Every fixed sentence on the pages, in both languages. */
export const t = {
  nav: {
    services: { zh: "服务", en: "Services" },
    pricing: { zh: "价格", en: "Pricing" },
    how: { zh: "合作流程", en: "How it works" },
    location: { zh: "仓库位置", en: "Location" },
    login: { zh: "客户登录", en: "Client login" },
    quote: { zh: "获取报价", en: "Get a quote" },
  },
  heroCta: { zh: "30 秒算出你的费用 →", en: "Estimate your cost in 30 s →" },
  heroCta2: { zh: "预约参观仓库", en: "Book a warehouse visit" },
  platformsLabel: { zh: "支持这些平台的订单", en: "Orders from" },
  heroCard: { zh: "费用估算 · 每月 1,000 单", en: "Estimate · 1,000 orders / month" },
  heroCardPer: { zh: "平均每单", en: "Per order" },
  heroCardNote: { zh: "不含尾程运费", en: "postage excluded" },
  cutoff: { zh: "16:00 前下单 · 当天发出", en: "Order by 4 pm · ships today" },
  photo: { zh: "仓库实拍照片", en: "Warehouse photo" },
  servicesKicker: { zh: "我们的服务", en: "What we do" },
  servicesTitle: { zh: "从收货到送到买家手里，一站搞定", en: "From receiving to your buyer's door" },
  howKicker: { zh: "合作流程", en: "How it works" },
  howTitle: { zh: "开户到发出第一单，最快 3 天", en: "From sign-up to first shipment in 3 days" },
  pricingKicker: { zh: "价格", en: "Pricing" },
  pricingTitle: { zh: "价格透明，没有隐藏费用", en: "Transparent pricing, no hidden fees" },
  pricingBody: { zh: "右边是标准价。不确定自己每月要花多少？填一下商品尺寸和单量，马上算出来。", en: "Our standard rates. Not sure what you'd pay each month? Enter your product and volume." },
  pricingCta: { zh: "打开费用计算器 →", en: "Open the cost calculator →" },
  pricingNote: { zh: "示例价格，以正式报价为准。尾程运费按实际面单计算。", en: "Example prices; your quote is final. Postage is billed at label cost." },
  priceRows: {
    receivingPerUnit: { zh: "入库上架", en: "Receiving" },
    storagePerCubicFootMonth: { zh: "仓储", en: "Storage" },
    pickFirstItem: { zh: "一件代发（首件）", en: "Pick & pack (first item)" },
    pickExtraItem: { zh: "同单续件", en: "Each extra item" },
    oversizePerOrder: { zh: "大件附加（>50 lb 或 >48 in）", en: "Oversize (>50 lb or >48 in)" },
  },
  priceUnits: {
    receivingPerUnit: { zh: "/ 件", en: "/ unit" },
    storagePerCubicFootMonth: { zh: "/ 立方英尺 / 月", en: "/ cu ft / month" },
    pickFirstItem: { zh: "/ 单", en: "/ order" },
    pickExtraItem: { zh: "/ 件", en: "/ item" },
    oversizePerOrder: { zh: "/ 单", en: "/ order" },
  },
  portalKicker: { zh: "客户后台", en: "Client portal" },
  portalTitle: { zh: "库存、订单、账单，半夜也能自己查", en: "Inventory, orders and bills, any time of night" },
  portalBody: { zh: "每个卖家一个账号，只看到自己的货。不用再等仓库回微信。", en: "One login per seller, showing only their own goods. No more waiting for replies." },
  portalSample: { zh: "示例数据", en: "Sample data" },
  portalTabs: { zh: ["库存", "订单", "入库", "账单"], en: ["Inventory", "Orders", "Inbound", "Bills"] },
  portalCols: { zh: ["SKU", "可用", "在途", "状态"], en: ["SKU", "Available", "Inbound", "Status"] },
  stockOk: { zh: "充足", en: "In stock" },
  stockLow: { zh: "快卖完", en: "Low" },
  locationKicker: { zh: "仓库位置", en: "Location" },
  map: { zh: "地图", en: "Map" },
  address: { zh: "地址", en: "Address" },
  ctaTitle: { zh: "先算算，再决定", en: "Run the numbers first" },
  ctaBody: { zh: "30 秒出报价，一个工作日内专人联系你。", en: "A quote in 30 seconds, a real person within one business day." },
  quote: {
    kicker: { zh: "在线报价", en: "Get a quote" },
    title: { zh: "30 秒算出每月大概多少钱", en: "Your monthly cost in 30 seconds" },
    lede: { zh: "填商品尺寸和单量，右边马上更新。满意的话一键发给我们，一个工作日内回复。", en: "Enter your product and volume; the estimate updates as you type. Send it to us in one click." },
    product: { zh: "① 单件商品（含包装）", en: "① One unit (packed)" },
    length: { zh: "长 (in)", en: "Length (in)" },
    width: { zh: "宽 (in)", en: "Width (in)" },
    height: { zh: "高 (in)", en: "Height (in)" },
    weight: { zh: "重量 (lb)", en: "Weight (lb)" },
    volume: { zh: "② 单量", en: "② Volume" },
    orders: { zh: "每月订单数", en: "Orders per month" },
    itemsPerOrder: { zh: "每单平均件数", en: "Items per order" },
    stored: { zh: "平均在库件数", en: "Units in stock (average)" },
    inbound: { zh: "每月入库件数", en: "Units received per month" },
    result: { zh: "每月预估", en: "Monthly estimate" },
    perOrder: { zh: "平均每单", en: "Per order" },
    receiving: { zh: "入库上架", en: "Receiving" },
    storage: { zh: "仓储", en: "Storage" },
    pick: { zh: "一件代发", en: "Pick & pack" },
    oversize: { zh: "大件附加", en: "Oversize" },
    minimum: { zh: "月最低消费补足", en: "Monthly minimum top-up" },
    oversizeHint: { zh: "超过大件标准，每单加收大件费", en: "Over the oversize limits: surcharge per order" },
    excl: { zh: "不含尾程运费（按实际面单）。示例价格，以正式报价为准。", en: "Postage not included (billed at label cost). Example prices; your quote is final." },
    cta: { zh: "按这个报价联系我们 →", en: "Send this quote to us →" },
    reply: { zh: "一个工作日内中文回复", en: "Reply within one business day" },
  },
  contact: {
    kicker: { zh: "联系我们", en: "Contact" },
    title: { zh: "留个联系方式，我们来找你", en: "Leave your details, we'll reach out" },
    lede: { zh: "一个工作日内回复。只填前两项也可以。", en: "We reply within one business day. Only the first two fields are required." },
    name: { zh: "称呼", en: "Name" },
    email: { zh: "邮箱", en: "Email" },
    phone: { zh: "微信 / WhatsApp / 电话", en: "WeChat / WhatsApp / phone" },
    company: { zh: "店铺或公司", en: "Store or company" },
    platforms: { zh: "在哪些平台卖", en: "Where you sell" },
    monthlyOrders: { zh: "每月大约多少单", en: "Orders per month" },
    message: { zh: "还有什么想说的", en: "Anything else" },
    send: { zh: "发送", en: "Send" },
    attached: { zh: "已附上你的报价估算", en: "Your estimate is attached" },
    sent: { zh: "收到了！我们会尽快联系你。确认邮件已发到你的邮箱。", en: "Got it! We'll be in touch soon. A confirmation is on its way to your inbox." },
    error: { zh: "没发出去：", en: "Couldn't send: " },
    wechat: { zh: "微信", en: "WeChat" },
    hours: { zh: "工作时间", en: "Hours" },
  },
  footer: { zh: "示例网站 · 页面上的数字和价格均为示例", en: "Demo site · numbers and prices are examples" },
};

export function pick(text: Text, lang: Lang): string {
  return text[lang] ?? text.zh;
}

export function langFrom(value: string | string[] | undefined): Lang {
  return value === "en" ? "en" : "zh";
}

export function money(n: number, digits = 2): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
