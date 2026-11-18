const PROMPT = `Bu Standoff 2 o'yinining inventar (inventory) skrinshoti.
Undagi har bir ko'rinib turgan skin/predmetni o'qib chiq. Faqat JSON massiv qaytar, boshqa matn yozma:
[{"weapon":"AKR","name":"Fire Drake","count":1}]
Qoidalar:
- "weapon" — qurol nomi (AKR, M4, AWM, Karambit, ...), "name" — skin nomi.
- "count" — agar katakda "x2" kabi miqdor ko'rsatilgan bo'lsa shu son, aks holda 1.
- Faqat aniq o'qiy olgan predmetlarni qo'sh, taxmin qilma. Stiker, charm, graffiti, quti ham bo'lsa, weapon bo'sh qoldirib name'ga nomini yoz.`;

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY o'rnatilmagan (.env.local faylga qo'shing)." },
      { status: 500 },
    );
  }

  let image: string;
  let mediaType: string;
  try {
    ({ image, mediaType } = await request.json());
    if (!image) throw new Error();
  } catch {
    return Response.json({ error: "Rasm yuborilmadi." }, { status: 400 });
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5-5",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType || "image/jpeg",
                data: image,
              },
            },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return Response.json(
      { error: `AI xatosi (${res.status}): ${text.slice(0, 300)}` },
      { status: 502 },
    );
  }

  const data = await res.json();
  const text: string =
    data.content?.find((c: { type: string }) => c.type === "text")?.text ?? "";
  const json = text.match(/\[[\s\S]*\]/)?.[0];
  try {
    const items = JSON.parse(json ?? "[]");
    return Response.json({ items });
  } catch {
    return Response.json(
      { error: "AI javobini o'qib bo'lmadi.", raw: text.slice(0, 500) },
      { status: 502 },
    );
  }
}
