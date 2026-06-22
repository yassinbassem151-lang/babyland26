// AI Assistant - Egyptian Arabic voice assistant with reliable report actions
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCHEMA_DOC = `
الجداول المتاحة وأسماء الأعمدة الحقيقية:

versions(id uuid, name text, is_active boolean, created_at timestamptz)
products(id uuid, code text, name text, description text, price numeric, image_url text, stock_quantity integer, low_stock_threshold integer, version_id uuid, created_at timestamptz)
customers(id uuid, name text, shop_name text, phone text, address text, is_new boolean, version_id uuid, created_at timestamptz)
orders(id uuid, order_number integer, customer_id uuid, customer_name text, shop_name text, phone text, address text, delivery_date date, shipping_company text, deposit_method text, deposit_amount numeric, subtotal numeric, total numeric, status text, progress_status text, staff_member_id uuid, staff_member_name text, extra_info text, version_id uuid, created_at timestamptz, updated_at timestamptz)
order_items(id uuid, order_id uuid, product_id uuid, product_code text, product_name text, product_description text, price numeric, quantity integer, fulfilled boolean, cancelled boolean, version_id uuid, created_at timestamptz)
order_returns(id uuid, customer_name text, shop_name text, phone text, address text, product_code text, product_name text, product_description text, quantity integer, unit_price numeric, total_amount numeric, notes text, version_id uuid, created_at timestamptz)
order_refunds(id uuid, order_id uuid, product_id uuid, product_code text, product_name text, product_description text, price numeric, quantity integer, version_id uuid, created_at timestamptz)
deposits(id uuid, order_id uuid, order_number integer, customer_name text, amount numeric, method text, version_id uuid, created_at timestamptz)
expenses(id uuid, amount numeric, description text, expense_date date, version_id uuid, created_at timestamptz)
shipping_details(id uuid, order_id uuid, order_number integer, customer_name text, phone text, address text, shipping_company text, tracking_number text, version_id uuid, created_at timestamptz)
stock_alerts(id uuid, product_id uuid, product_code text, product_name text, remaining_quantity integer, acknowledged boolean, acknowledged_at timestamptz, version_id uuid, created_at timestamptz)
staff_members(id uuid, name text, pin text, permissions text[], is_active boolean, created_at timestamptz)

قواعد مهمة:
- فلتر دايماً بـ version_id = '{ACTIVE_VERSION}' في products, customers, orders, order_items, returns, refunds, deposits, expenses, shipping_details, stock_alerts.
- متستخدمش أعمدة غير موجودة زي total_amount أو remaining_amount أو staff_name في orders. استخدم total، و subtotal، و staff_member_name، واحسب المتبقي: total - coalesce(deposit_amount,0).
- وصف المنتج ممكن يكون فيه multiplier زي "200/20". في التحليل بالقطع: quantity * الرقم بعد /.
- استخدم LIMIT واضح، وخلّي النتائج مختصرة.
`;

const ROUTES = `
الصفحات المتاحة (للتنقل):
- /admin/dashboard => الإحصائيات
- /admin/dashboard/products => المنتجات
- /admin/dashboard/orders => الطلبات
- /admin/dashboard/orders-progress => تقدم الطلبات
- /admin/dashboard/shipping-details => تفاصيل الشحن
- /admin/dashboard/orders-return => مرتجعات
- /admin/dashboard/customers => العملاء
- /admin/dashboard/deposits => العربون
- /admin/dashboard/search-by-code => البحث بالكود
- /admin/dashboard/stock-alerts => تنبيهات المخزون
- /admin/dashboard/product-report => تقرير المنتجات
- /admin/dashboard/daily-sales => المبيعات اليومية
- /admin/dashboard/product-prices => أسعار المنتجات
- /admin/dashboard/staff => الموظفين
- /admin/dashboard/backup => النسخ الاحتياطي
`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_report",
      description: "يجلب تقارير جاهزة وسريعة من بيانات الموقع بدون كتابة SQL. استخدمه أولاً للأسئلة الشائعة والتقارير والإكسيل.",
      parameters: {
        type: "object",
        properties: {
          report: {
            type: "string",
            enum: [
              "today_orders",
              "sales_overview",
              "weekly_sales",
              "monthly_sales",
              "low_stock",
              "top_products",
              "top_customers",
              "deposits_summary",
              "open_orders",
              "invoice_export",
            ],
          },
          limit: { type: "number", description: "عدد الصفوف المطلوب، افتراضي 50" },
        },
        required: ["report"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_sql",
      description: "ينفذ استعلام SELECT مخصص عند الحاجة فقط. استخدم get_report للأسئلة الشائعة. SELECT فقط ولازم تستخدم أسماء الأعمدة الحقيقية من schema.",
      parameters: {
        type: "object",
        properties: {
          sql: { type: "string", description: "استعلام SELECT صحيح" },
          purpose: { type: "string", description: "ليه بتعمل الاستعلام ده باختصار" },
        },
        required: ["sql"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "navigate",
      description: "ينقل المستخدم لصفحة معينة في لوحة التحكم.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "المسار الكامل مثل /admin/dashboard/orders" },
          highlight: { type: "string", description: "نص أو رقم لتمييزه في الصفحة (اختياري)" },
          reason: { type: "string", description: "ليه بتنقله لهنا" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "export_excel",
      description: "يصدر ملف Excel من بيانات حقيقية. ممنوع منعاً باتاً تخترع صفوف. لازم تحدد إما report (تقرير جاهز) أو sql (SELECT). السيرفر هو اللي بيجيب الصفوف ويصدرها — مش انت.",
      parameters: {
        type: "object",
        properties: {
          filename: { type: "string", description: "اسم الملف بدون امتداد أو بـ .xlsx" },
          title: { type: "string", description: "عنوان الشيت" },
          report: {
            type: "string",
            enum: [
              "today_orders",
              "sales_overview",
              "weekly_sales",
              "monthly_sales",
              "low_stock",
              "top_products",
              "top_customers",
              "deposits_summary",
              "open_orders",
              "invoice_export",
            ],
            description: "اسم تقرير جاهز يجلب بياناته السيرفر",
          },
          sql: { type: "string", description: "SELECT مخصص. للمدير الكامل فقط." },
          limit: { type: "number" },
        },
        required: ["filename"],
      },
    },
  },
];

function isSafeSql(sql: string): boolean {
  const s = sql.trim().toLowerCase();
  if (!s.startsWith("select") && !s.startsWith("with")) return false;
  const forbidden = /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|comment|copy|call|do|execute)\b/;
  return !forbidden.test(s);
}

const toNumber = (value: unknown) => Number(value || 0);
const isFullAdmin = (permissions: string[] = []) => permissions.includes("all");

function canAccessReport(report: string, permissions: string[] = []) {
  if (isFullAdmin(permissions)) return true;
  const has = (keys: string[]) => keys.some((key) => permissions.includes(key));
  if (["sales_overview", "weekly_sales", "monthly_sales", "deposits_summary", "top_customers", "invoice_export"].includes(report)) return false;
  if (report === "today_orders" || report === "open_orders") return has(["orders", "orders_progress", "daily_sales"]);
  if (report === "low_stock") return has(["products", "stock_alerts"]);
  if (report === "top_products") return has(["product_report", "search", "products", "daily_sales"]);
  return false;
}

function sanitizeForPermissions(report: string, result: any, permissions: string[] = []) {
  if (isFullAdmin(permissions) || !result?.ok) return result;
  const stripMoney = (row: any) => {
    const { total, subtotal, price, deposit_amount, amount, deposits, sales, total_sales, total_amount, remaining_amount, ...safe } = row || {};
    return safe;
  };
  if (["today_orders", "open_orders", "top_products"].includes(report)) {
    return { ...result, rows: (result.rows || []).map(stripMoney), summary: { count: result.rows?.length || result.summary?.count || result.summary?.orders_count || 0 } };
  }
  return result;
}

function compactRows(rows: any[] | null | undefined, limit = 50) {
  return (rows || []).slice(0, Math.max(1, Math.min(limit, 200)));
}

async function getReport(supabase: any, report: string, activeVersionId: string, limit = 50) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 200));
  const v = activeVersionId;
  if (!v) return { ok: false, error: "مفيش نسخة نشطة محددة" };

  if (report === "today_orders") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from("orders")
      .select("order_number, customer_name, shop_name, phone, total, deposit_amount, status, progress_status, staff_member_name, created_at")
      .eq("version_id", v)
      .gte("created_at", start.toISOString())
      .order("created_at", { ascending: false })
      .limit(safeLimit);
    if (error) return { ok: false, error: error.message };
    const total = (data || []).reduce((sum: number, row: any) => sum + toNumber(row.total), 0);
    return { ok: true, rows: data || [], summary: { orders_count: data?.length || 0, total_sales: total } };
  }

  if (report === "sales_overview") {
    const { data, error } = await supabase
      .from("orders")
      .select("order_number, customer_name, shop_name, phone, total, deposit_amount, status, staff_member_name, created_at")
      .eq("version_id", v)
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) return { ok: false, error: error.message };
    const rows = compactRows(data || [], safeLimit).map((o: any) => ({ ...o, remaining_amount: toNumber(o.total) - toNumber(o.deposit_amount) }));
    return {
      ok: true,
      rows,
      summary: {
        orders_count: data?.length || 0,
        total_sales: (data || []).reduce((sum: number, row: any) => sum + toNumber(row.total), 0),
        total_deposits: (data || []).reduce((sum: number, row: any) => sum + toNumber(row.deposit_amount), 0),
      },
    };
  }

  if (report === "weekly_sales" || report === "monthly_sales") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (report === "weekly_sales" ? 6 : 29));
    const { data, error } = await supabase
      .from("orders")
      .select("order_number, customer_name, shop_name, phone, total, deposit_amount, status, staff_member_name, created_at")
      .eq("version_id", v)
      .gte("created_at", start.toISOString())
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return { ok: false, error: error.message };
    const byDay = new Map<string, { date: string; orders: number; sales: number; deposits: number }>();
    for (const row of data || []) {
      const date = new Date(row.created_at).toLocaleDateString("ar-EG");
      const item = byDay.get(date) || { date, orders: 0, sales: 0, deposits: 0 };
      item.orders += 1;
      item.sales += toNumber(row.total);
      item.deposits += toNumber(row.deposit_amount);
      byDay.set(date, item);
    }
    const rows = Array.from(byDay.values());
    return {
      ok: true,
      rows: compactRows(rows, safeLimit),
      raw_orders: compactRows(data || [], safeLimit),
      summary: {
        orders_count: data?.length || 0,
        total_sales: (data || []).reduce((sum: number, row: any) => sum + toNumber(row.total), 0),
        total_deposits: (data || []).reduce((sum: number, row: any) => sum + toNumber(row.deposit_amount), 0),
      },
    };
  }

  if (report === "low_stock") {
    const { data, error } = await supabase
      .from("products")
      .select("code, name, description, price, stock_quantity, low_stock_threshold")
      .eq("version_id", v)
      .order("stock_quantity", { ascending: true })
      .limit(500);
    if (error) return { ok: false, error: error.message };
    const rows = (data || []).filter((p: any) => toNumber(p.stock_quantity) <= toNumber(p.low_stock_threshold || 5));
    return { ok: true, rows: compactRows(rows, safeLimit), summary: { products_count: rows.length } };
  }

  if (report === "top_products") {
    const { data, error } = await supabase
      .from("order_items")
      .select("product_code, product_name, product_description, price, quantity, cancelled")
      .eq("version_id", v)
      .limit(5000);
    if (error) return { ok: false, error: error.message };
    const map = new Map<string, any>();
    for (const item of data || []) {
      if (item.cancelled) continue;
      const key = item.product_code || item.product_name;
      const current = map.get(key) || { product_code: item.product_code, product_name: item.product_name, quantity: 0, sales: 0 };
      current.quantity += toNumber(item.quantity);
      current.sales += toNumber(item.quantity) * toNumber(item.price);
      map.set(key, current);
    }
    const rows = Array.from(map.values()).sort((a, b) => b.quantity - a.quantity);
    return { ok: true, rows: compactRows(rows, safeLimit), summary: { products_count: rows.length } };
  }

  if (report === "top_customers") {
    const { data, error } = await supabase
      .from("orders")
      .select("customer_name, shop_name, phone, total, deposit_amount")
      .eq("version_id", v)
      .limit(5000);
    if (error) return { ok: false, error: error.message };
    const map = new Map<string, any>();
    for (const order of data || []) {
      const key = order.phone || `${order.customer_name}-${order.shop_name}`;
      const current = map.get(key) || { customer_name: order.customer_name, shop_name: order.shop_name, phone: order.phone, orders: 0, total_sales: 0, deposits: 0 };
      current.orders += 1;
      current.total_sales += toNumber(order.total);
      current.deposits += toNumber(order.deposit_amount);
      map.set(key, current);
    }
    const rows = Array.from(map.values()).sort((a, b) => b.total_sales - a.total_sales);
    return { ok: true, rows: compactRows(rows, safeLimit), summary: { customers_count: rows.length } };
  }

  if (report === "deposits_summary") {
    const { data, error } = await supabase
      .from("deposits")
      .select("order_number, customer_name, amount, method, created_at")
      .eq("version_id", v)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return { ok: false, error: error.message };
    return { ok: true, rows: compactRows(data || [], safeLimit), summary: { count: data?.length || 0, total: (data || []).reduce((sum: number, row: any) => sum + toNumber(row.amount), 0) } };
  }

  if (report === "open_orders") {
    const { data, error } = await supabase
      .from("orders")
      .select("order_number, customer_name, shop_name, phone, total, deposit_amount, status, progress_status, delivery_date, created_at")
      .eq("version_id", v)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return { ok: false, error: error.message };
    const rows = (data || []).filter((o: any) => !["completed", "delivered", "cancelled"].includes(String(o.status || o.progress_status || "").toLowerCase()));
    return { ok: true, rows: compactRows(rows, safeLimit), summary: { count: rows.length, total_remaining: rows.reduce((sum: number, row: any) => sum + (toNumber(row.total) - toNumber(row.deposit_amount)), 0) } };
  }

  if (report === "invoice_export") {
    const { data, error } = await supabase
      .from("orders")
      .select("order_number, customer_name, shop_name, phone, address, total, deposit_amount, deposit_method, status, staff_member_name, created_at")
      .eq("version_id", v)
      .order("created_at", { ascending: false })
      .limit(safeLimit);
    if (error) return { ok: false, error: error.message };
    const rows = (data || []).map((o: any) => ({ ...o, remaining_amount: toNumber(o.total) - toNumber(o.deposit_amount) }));
    return { ok: true, rows, summary: { invoices_count: rows.length, total_sales: rows.reduce((sum: number, row: any) => sum + toNumber(row.total), 0) } };
  }

  return { ok: false, error: "نوع التقرير مش معروف" };
}

function inferReport(text: string): string | null {
  const t = text.toLowerCase();
  if (/فواتير|فاتورة|invoice/.test(t)) return "invoice_export";
  if (/كل|كلي|كاملة|اجمالي|إجمالي|total/.test(t) && /مبيع|مبيعات|sales/.test(t)) return "sales_overview";
  if (/النهارده|النهاردة|اليوم|today/.test(t) && /طلب|اوردر|مبيع|sales/.test(t)) return "today_orders";
  if (/اسبوع|أسبوع|week/.test(t)) return "weekly_sales";
  if (/شهر|monthly|month/.test(t)) return "monthly_sales";
  if (/مخزون|خلص|تخلص|ناقص|قربت|low/.test(t)) return "low_stock";
  if (/اكتر|أكتر|أفضل|افضل|top/.test(t) && /منتج|كود|products?/.test(t)) return "top_products";
  if (/اكتر|أكتر|أفضل|افضل|top/.test(t) && /عميل|زبون|customers?/.test(t)) return "top_customers";
  if (/عربون|عربون|deposit|deposits/.test(t)) return "deposits_summary";
  if (/مفتوح|متأخر|لسه|open|pending/.test(t) && /طلب|اوردر/.test(t)) return "open_orders";
  return null;
}

function wantsExcel(text: string): boolean {
  return /اكسيل|إكسيل|excel|xlsx|شيت|sheet|ملف/.test(text.toLowerCase());
}

function filenameForReport(report: string): string {
  const names: Record<string, string> = {
    today_orders: "طلبات-النهاردة.xlsx",
    sales_overview: "ملخص-المبيعات-الكلي.xlsx",
    weekly_sales: "مبيعات-الأسبوع.xlsx",
    monthly_sales: "مبيعات-الشهر.xlsx",
    low_stock: "منتجات-قربت-تخلص.xlsx",
    top_products: "أكتر-المنتجات-مبيعاً.xlsx",
    top_customers: "أكتر-العملاء-شراء.xlsx",
    deposits_summary: "ملخص-العربون.xlsx",
    open_orders: "الطلبات-المفتوحة.xlsx",
    invoice_export: "ملخص-الفواتير.xlsx",
  };
  return names[report] || "تقرير-Babyland.xlsx";
}

function inferNavigation(text: string): string | null {
  const t = text.toLowerCase();
  if (/منتجات|products?/.test(t)) return "/admin/dashboard/products";
  if (/طلبات|اوردر|orders?/.test(t)) return "/admin/dashboard/orders";
  if (/عملاء|عميل|customers?/.test(t)) return "/admin/dashboard/customers";
  if (/عربون|deposits?/.test(t)) return "/admin/dashboard/deposits";
  if (/مخزون|تنبيه|خلص/.test(t)) return "/admin/dashboard/stock-alerts";
  if (/تقرير/.test(t)) return "/admin/dashboard/product-report";
  if (/مبيعات/.test(t)) return "/admin/dashboard/daily-sales";
  if (/نسخ|backup/.test(t)) return "/admin/dashboard/backup";
  return null;
}

function reportText(report: string, result: any, exported: boolean): string {
  const rows = result.rows || [];
  const summary = result.summary || {};
  const money = (n: unknown) => Math.round(toNumber(n)).toLocaleString("ar-EG");
  const suffix = exported ? " ونزلتلك ملف الإكسيل." : "";

  if (!rows.length) return exported ? "ملقتش بيانات للفترة دي، عشان كده مش هينفع أطلع شيت مفيد." : "ملقتش بيانات للفترة دي.";
  if (report === "today_orders") return `عندك ${summary.orders_count} طلب النهارده بإجمالي ${money(summary.total_sales)} جنيه${suffix}`;
  if (report === "sales_overview") return `إجمالي المبيعات ${summary.orders_count} طلب، بقيمة ${money(summary.total_sales)} جنيه، والعربون ${money(summary.total_deposits)} جنيه${suffix}`;
  if (report === "weekly_sales") return `مبيعات الأسبوع ${summary.orders_count} طلب، بإجمالي ${money(summary.total_sales)} جنيه، والعربون ${money(summary.total_deposits)} جنيه${suffix}`;
  if (report === "monthly_sales") return `مبيعات الشهر ${summary.orders_count} طلب، بإجمالي ${money(summary.total_sales)} جنيه، والعربون ${money(summary.total_deposits)} جنيه${suffix}`;
  if (report === "low_stock") return `عندك ${summary.products_count} منتج محتاج متابعة في المخزون. أقلهم ${rows[0]?.code || ""} - ${rows[0]?.name || ""}${suffix}`;
  if (report === "top_products") return `أكتر منتج متباع هو ${rows[0]?.product_code || ""} - ${rows[0]?.product_name || ""} بكمية ${rows[0]?.quantity || 0}${suffix}`;
  if (report === "top_customers") return `أكتر عميل شراء هو ${rows[0]?.customer_name || rows[0]?.shop_name || "عميل بدون اسم"} بإجمالي ${money(rows[0]?.total_sales)} جنيه من ${rows[0]?.orders || 0} طلب${suffix}`;
  if (report === "deposits_summary") return `إجمالي العربون المسجل ${money(summary.total)} جنيه من ${summary.count} عملية${suffix}`;
  if (report === "open_orders") return `عندك ${summary.count} طلب مفتوح، والمتبقي عليهم حوالي ${money(summary.total_remaining)} جنيه${suffix}`;
  if (report === "invoice_export") return `جهزت ملخص الفواتير: ${summary.invoices_count} فاتورة بإجمالي ${money(summary.total_sales)} جنيه${suffix}`;
  return `تمام، لقيت ${rows.length} نتيجة${suffix}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, activeVersionId, permissions } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const lastUserText = [...(messages || [])].reverse().find((m: any) => m.role === "user")?.content || "";
    const directReport = inferReport(lastUserText);
    const directPath = /افتح|روح|وديني|وريني|show|open|go/.test(lastUserText.toLowerCase()) ? inferNavigation(lastUserText) : null;

    if (directReport) {
      if (!canAccessReport(directReport, permissions || [])) {
        return new Response(JSON.stringify({ text: "الصلاحية اللي معاك مش كافية للتقرير ده.", actions: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const rawResult = await getReport(supabase, directReport, activeVersionId, wantsExcel(lastUserText) ? 200 : 50);
      const result = sanitizeForPermissions(directReport, rawResult, permissions || []);
      const actions: any[] = [];
      if (directPath) {
        const first = result?.rows?.[0];
        actions.push({ type: "navigate", path: directPath, highlight: first?.order_number || first?.code || first?.product_code || first?.customer_name || first?.phone });
      }
      if (wantsExcel(lastUserText) && result.ok && result.rows?.length) {
        actions.push({ type: "export_excel", filename: filenameForReport(directReport), rows: result.rows, title: filenameForReport(directReport).replace(".xlsx", "") });
      }
      return new Response(JSON.stringify({ text: result.ok ? reportText(directReport, result, actions.some((a) => a.type === "export_excel")) : result.error, actions }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (directPath) {
      return new Response(JSON.stringify({ text: "تمام، فتحتلك الصفحة المطلوبة.", actions: [{ type: "navigate", path: directPath }] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `أنت "بيبي" - المساعد الذكي لمحل Babyland لملابس الأطفال (شات مكتوب).

🎯 شخصيتك:
- بتتكلم مصري بحت زي ما المصريين بيتكلموا في الشغل. مش فصحى.
- ودود، عملي، وذكي. زي شريك شغل بيفهم في التجارة والأرقام.
- ردودك واضحة ومنظمة. ممكن تستخدم نقاط أو جداول صغيرة في النص لأن الرد بيتعرض مكتوب.

🛠️ قدراتك:
1. get_report: تقارير جاهزة موثوقة (مبيعات، طلبات، عملاء، مخزون، عربون). استخدمه دايماً للأسئلة الشائعة.
2. run_sql: SELECT حر لما تحتاج تحليل مخصوص (للمدير الكامل فقط). استخدم أسماء الأعمدة الحقيقية بالظبط.
3. navigate: ينقل المستخدم لصفحة وممكن يبرز عنصر.
4. export_excel: يصدر ملف. ممنوع تبعت rows من عندك — لازم تبعت report أو sql والسيرفر بيجيب البيانات الحقيقية.

📊 منهجية التحليل (مهم جداً):
- لما تتسأل تحليل، شغّل get_report أو run_sql الأول، اقرا الأرقام الفعلية، وبعدها رد بتحليل مبني عليها (مش تخمين).
- لو السؤال محتاج كذا زاوية (مثلاً "حللي مبيعات الأسبوع")، استدعي أكتر من تقرير/استعلام واجمع النتايج.
- ارجع بأرقام محددة: إجمالي، متوسط، أعلى/أقل، نسب نمو، أنماط.
- لو الداتا فاضية، قول كده بصراحة. متخترعش أرقام.

📁 الإكسيل:
- لما المستخدم يطلب شيت، استدعي export_excel بـ report المناسب (أو sql مخصوص). السيرفر هيملا البيانات.
- متبعتش rows في export_excel أبداً.
- لو الداتا فاضية، السيرفر هيرفض. وقتها قول للمستخدم إن مفيش بيانات للفترة دي.

⚙️ معلومات النظام:
- ID النسخة النشطة: ${activeVersionId || "غير محدد"}
- صلاحيات المستخدم: ${(permissions || ["all"]).join(", ")}
${SCHEMA_DOC.replace("{ACTIVE_VERSION}", activeVersionId || "")}
${ROUTES}

❗ قواعد صارمة:
- ممنوع تخترع أرقام أو صفوف. كل رقم لازم يجي من tool.
- لو tool رجع error، جرّب get_report بديل أو SQL أبسط مرة واحدة قبل ما تعتذر.
- ردودك مكتوبة (مش صوت)، فاستخدم تنسيق منظم.`;

    const convo = [{ role: "system", content: systemPrompt }, ...messages];
    const actions: any[] = [];
    let finalText = "";

    // Tool loop - max 6 iterations
    for (let i = 0; i < 6; i++) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: convo,
          tools: TOOLS,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        if (res.status === 429) {
          return new Response(JSON.stringify({ error: "تخطيت حد الاستخدام، استنى شوية." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (res.status === 402) {
          return new Response(JSON.stringify({ error: "الرصيد خلص، لازم تشحن credits." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: `AI error: ${errText}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await res.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) break;

      convo.push(msg);

      const toolCalls = msg.tool_calls || [];
      if (toolCalls.length === 0) {
        finalText = msg.content || "";
        break;
      }

      for (const call of toolCalls) {
        const name = call.function.name;
        let args: any = {};
        try { args = JSON.parse(call.function.arguments || "{}"); } catch {}

        let result: any = { ok: true };

        if (name === "get_report") {
          if (!canAccessReport(args.report, permissions || [])) {
            result = { ok: false, error: "الصلاحية اللي معاك مش كافية للتقرير ده" };
          } else {
            const rawResult = await getReport(supabase, args.report, activeVersionId, args.limit);
            result = sanitizeForPermissions(args.report, rawResult, permissions || []);
          }
        } else if (name === "run_sql") {
          if (!isFullAdmin(permissions || [])) {
            result = { ok: false, error: "التحليل الحر متاح للمدير الكامل فقط. استخدم التقارير المتاحة حسب الصلاحية." };
          } else if (!isSafeSql(args.sql || "")) {
            result = { ok: false, error: "SELECT فقط مسموح" };
          } else {
            const { data: rows, error } = await supabase.rpc("execute_readonly_sql", { query: args.sql });
            if (error) {
              // Fallback: try direct query via REST not possible, return error
              result = { ok: false, error: error.message, hint: "استخدم get_report أو أسماء الأعمدة الحقيقية: orders.total وليس total_amount" };
            } else {
              result = { ok: true, rows: rows, count: Array.isArray(rows) ? rows.length : 0 };
            }
          }
        } else if (name === "navigate") {
          actions.push({ type: "navigate", path: args.path, highlight: args.highlight, reason: args.reason });
          result = { ok: true, navigated_to: args.path };
        } else if (name === "export_excel") {
          const fname = String(args.filename || "تقرير").endsWith(".xlsx") ? args.filename : `${args.filename}.xlsx`;
          let rows: any[] = [];
          let err: string | null = null;
          if (args.report) {
            if (!canAccessReport(args.report, permissions || [])) {
              err = "الصلاحية مش كافية للتقرير ده";
            } else {
              const r = await getReport(supabase, args.report, activeVersionId, args.limit || 500);
              const safe = sanitizeForPermissions(args.report, r, permissions || []);
              if (!safe.ok) err = safe.error;
              else rows = safe.rows || [];
            }
          } else if (args.sql) {
            if (!isFullAdmin(permissions || [])) err = "SQL مخصص للمدير الكامل فقط";
            else if (!isSafeSql(args.sql)) err = "SELECT فقط مسموح";
            else {
              const { data: r, error } = await supabase.rpc("execute_readonly_sql", { query: args.sql });
              if (error) err = error.message;
              else rows = Array.isArray(r) ? r : [];
            }
          } else {
            err = "لازم تحدد report أو sql";
          }
          if (err) {
            result = { ok: false, error: err };
          } else if (!rows.length) {
            result = { ok: false, error: "ملقتش بيانات للتصدير، متعملش ملف فاضي" };
          } else {
            actions.push({ type: "export_excel", filename: fname, rows, title: args.title || fname.replace(".xlsx", "") });
            result = { ok: true, exported: fname, rows_count: rows.length };
          }
        }

        convo.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    return new Response(JSON.stringify({ text: finalText, actions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
