export const runtime = "nodejs";
export const maxDuration = 60;

function escapeSsml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeRate(rate) {
  if (rate.startsWith("-") || rate.startsWith("+")) return rate;
  if (rate === "0%") return "+0%";
  return `+${rate}`;
}

export async function POST(request) {
  try {
    const { text, voice = "it-IT-DiegoNeural", rate = "0%", pitch = "0Hz" } =
      await request.json();

    if (!text || !text.trim()) {
      return new Response(JSON.stringify({ error: "Testo mancante" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const key = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;

    if (!key || !region) {
      return new Response(
        JSON.stringify({
          error:
            "Configurazione mancante: aggiungi AZURE_SPEECH_KEY e AZURE_SPEECH_REGION nelle variabili d'ambiente di Vercel.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const ssml = `<speak version="1.0" xml:lang="it-IT">
  <voice name="${voice}">
    <prosody rate="${normalizeRate(rate)}" pitch="${pitch}">${escapeSsml(text)}</prosody>
  </voice>
</speak>`;

    const azureRes = await fetch(
      `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": key,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
          "User-Agent": "voce-di-carta",
        },
        body: ssml,
      }
    );

    if (!azureRes.ok) {
      const details = await azureRes.text();
      console.error("Errore Azure TTS:", azureRes.status, details);
      return new Response(
        JSON.stringify({
          error: "Generazione audio non riuscita",
          details: `Azure ha risposto ${azureRes.status}`,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const audioBuffer = Buffer.from(await azureRes.arrayBuffer());

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Errore TTS:", err);
    return new Response(
      JSON.stringify({ error: "Generazione audio non riuscita", details: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
