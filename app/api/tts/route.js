import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

// Deve girare su Node.js (non Edge runtime) perché msedge-tts apre una
// connessione WebSocket verso il servizio vocale di Microsoft.
export const runtime = "nodejs";
export const maxDuration = 60;

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

    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    const { audioStream } = tts.toStream(text, { rate, pitch });

    const chunks = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

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
