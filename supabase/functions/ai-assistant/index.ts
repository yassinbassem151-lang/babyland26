// AI Assistant - Egyptian Arabic voice assistant with DB access and tool calls
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCHEMA_DOC = `
الجداول المتاحة (PostgreSQL):

versions(id uuid, name text, is_active boolean, created_at)
products(id, code text, name text, description text, price numeric, stock_quantity int, version_id uuid, is_active bool, created_at)
customers(id, name, shop_name, phone, address, is_new bool, version_id, created_at)
orders(id, order_number int, customer_id, customer_name, shop_name, phone, address, delivery_date, status text, total_amount numeric, deposit_amount numeric, deposit_method text, remaining_amount numeric, notes text, staff_name text, version_id, created_at, updated_at, returned bool, shipped bool, cancelled bool)
order_items(id, order_id, product_id, product_code, product_name, product_description, price, quantity, version_id, fulfilled bool, cancelled bool, created_at)
order_returns(id, customer_name, shop_name, phone, product_code, product_name, product_description, quantity, unit_price, total_amount, notes, version_id, created_at)
order_refunds(id, order_id, product_id, product_code, product_name, price, quantity, version_id, created_at)
deposits(id, order_id, order_number, customer_name, amount, method, version_id, created_at)
expenses(id, amount, description, expense_date, version_id, created_at)
shipping_details(...)
stock_alerts(id, product_id, product_code, product_name, threshold int, acknowledged bool, version_id, created_at)
staff_members(id, name, pin, permissions text[], created_at)

ملاحظات مهمة:
- لازم تفلتر دايماً بـ version_id = '{ACTIVE_VERSION}' لكل استعلام عن المنتجات والطلبات والعملاء.
- description المنتج فيها multiplier زي "200/20" يعني كل قطعة = 20 من المخزون.
- للمبيعات اليومية: استخدم date_trunc('day', created_at) على orders.
- استخدم LIMIT 200 الحد الأقصى.
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
      name: "run_sql",
      description: "ينفذ استعلام SELECT على قاعدة البيانات. SELECT فقط - لا INSERT/UPDATE/DELETE. لازم تفلتر بـ version_id للجداول اللي بتحتاج ده.",
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
      description: "يصدر بيانات كملف Excel يقدر المستخدم يحفظه. ابعت الصفوف كـ array of objects.",
      parameters: {
        type: "object",
        properties: {
          filename: { type: "string" },
          rows: {
            type: "array",
            items: { type: "object", additionalProperties: true },
          },
          title: { type: "string", description: "عنوان الملف للعرض" },
        },
        required: ["filename", "rows"],
      },
    },
  },
];

function isSafeSql(sql: string): boolean {
  const s = sql.trim().toLowerCase();
  if (!s.startsWith("select") && !s.startsWith("with")) return false;
  const forbidden = /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|comment)\b/;
  return !forbidden.test(s);
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

    const systemPrompt = `أنت "بيبي" - المساعد الذكي الصوتي لمحل Babyland لملابس الأطفال.

🎯 شخصيتك:
- بتتكلم مصري بحت زي ما المصريين بيتكلموا في الشغل. مش فصحى أبداً.
- ودود، سريع، عملي، وذكي. زي شريك شغل بيفهم في التجارة والأرقام.
- ردودك قصيرة ومفيدة لأنها هتتقري بالصوت. متطولش في الكلام.

🛠️ قدراتك:
1. عندك صلاحية كاملة على قاعدة البيانات - استخدم run_sql لأي سؤال عن المنتجات، الطلبات، العملاء، المبيعات، المخزون، الأرباح.
2. تقدر تنقل المستخدم لأي صفحة بـ navigate وتعمل highlight لحاجة معينة.
3. تقدر تصدر Excel لأي تحليل بـ export_excel.

📊 منهجيتك:
- لما تتسأل سؤال عن بيانات، اعمل SQL، حلل النتيجة، وارجع رد قصير واضح بالأرقام.
- لو المستخدم قال "وريني" أو "روح" أو "افتح" - استخدم navigate.
- لو طلب تحليل أو تقرير أو "اعمللي إكسيل" - استخدم export_excel.
- ممكن تستخدم أكتر من tool في نفس الرد (تجيب البيانات بـ run_sql الأول، بعدين تصدرها).

⚙️ معلومات النظام:
- ID النسخة النشطة الحالية: ${activeVersionId || "غير محدد"}
- صلاحيات المستخدم الحالي: ${(permissions || ["all"]).join(", ")}
${SCHEMA_DOC.replace("{ACTIVE_VERSION}", activeVersionId || "")}
${ROUTES}

❗ قواعد:
- متستخدمش رموز markdown زي ** أو # لأن الرد بيتقري صوت.
- لو السؤال محتاج بيانات، اعمل run_sql قبل ما ترد. متخمنش.
- لو ملقتش بيانات، قول كده بصراحة.
- خلي الأرقام واضحة بالعربي (مثلاً: "عندك 45 طلب النهاردة").`;

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

        if (name === "run_sql") {
          if (!isSafeSql(args.sql || "")) {
            result = { ok: false, error: "SELECT فقط مسموح" };
          } else {
            const { data: rows, error } = await supabase.rpc("execute_readonly_sql", { query: args.sql });
            if (error) {
              // Fallback: try direct query via REST not possible, return error
              result = { ok: false, error: error.message, hint: "ممكن تحتاج تستخدم استعلام أبسط" };
            } else {
              result = { ok: true, rows: rows, count: Array.isArray(rows) ? rows.length : 0 };
            }
          }
        } else if (name === "navigate") {
          actions.push({ type: "navigate", path: args.path, highlight: args.highlight, reason: args.reason });
          result = { ok: true, navigated_to: args.path };
        } else if (name === "export_excel") {
          actions.push({ type: "export_excel", filename: args.filename, rows: args.rows, title: args.title });
          result = { ok: true, exported: args.filename, rows_count: args.rows?.length || 0 };
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
