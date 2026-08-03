"use client";

import { useRef, useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "voce-di-carta:documento";
const NOTES_KEY = "voce-di-carta:appunti";
const USAGE_PREFIX = "voce-di-carta:utilizzo:";
const MONTHLY_LIMIT = 500000;

const VOICES = [
  { id: "it-IT-GiuseppeNeural", label: "Giuseppe", note: "caldo, naturale" },
  { id: "it-IT-BenignoNeural", label: "Benigno", note: "caldo, rassicurante" },
  { id: "it-IT-LisandroNeural", label: "Lisandro", note: "maturo, riflessivo" },
  { id: "it-IT-CataldoNeural", label: "Cataldo", note: "maturo, corposo" },
  { id: "it-IT-GianniNeural", label: "Gianni", note: "asciutto, diretto" },
];

const RATES = [
  { id: "-15%", label: "Lenta" },
  { id: "0%", label: "Naturale" },
  { id: "15%", label: "Sostenuta" },
];

function splitIntoChunks(rawText) {
  const paragraphs = rawText
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}|\n(?=\s*\n)/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const chunks = [];
  const MAX = 900;

  for (const para of paragraphs) {
    if (para.length <= MAX) {
      chunks.push(para);
      continue;
    }
    const sentences = para.match(/[^.!?]+[.!?]+(\s|$)/g) || [para];
    let current = "";
    for (const s of sentences) {
      if ((current + s).length > MAX && current) {
        chunks.push(current.trim());
        current = s;
      } else {
        current += s;
      }
    }
    if (current.trim()) chunks.push(current.trim());
  }
  return chunks;
}

function totalChars(parts) {
  return parts.reduce((sum, p) => sum + p.length, 0);
}

export default function Home() {
  const [fileName, setFileName] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [voice, setVoice] = useState(VOICES[0].id);
  const [rate, setRate] = useState("0%");
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("In attesa di un documento");

  const [inputMode, setInputMode] = useState("file"); // "file" | "text"
  const [textDraft, setTextDraft] = useState("");
  const [savedNotes, setSavedNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [monthlyUsage, setMonthlyUsage] = useState(0);

  const audioRef = useRef(null);
  const cacheRef = useRef(new Map());

  // Al primo avvio, riprendi l'ultimo documento letto (se presente)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.chunks?.length) {
          setFileName(saved.fileName || null);
          setChunks(saved.chunks);
          setCurrentIndex(saved.currentIndex || 0);
          setStatus(
            `Ripreso — paragrafo ${(saved.currentIndex || 0) + 1} di ${saved.chunks.length} · ${totalChars(saved.chunks).toLocaleString("it-IT")} caratteri totali`
          );
        }
      }
    } catch (err) {
      console.error("Impossibile ripristinare il documento salvato:", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Salva automaticamente documento e punto di lettura ad ogni cambiamento
  useEffect(() => {
    if (!chunks.length) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ fileName, chunks, currentIndex })
      );
    } catch (err) {
      console.error("Impossibile salvare il documento:", err);
    }
  }, [chunks, currentIndex, fileName]);

  // Carica gli appunti salvati al primo avvio
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(NOTES_KEY);
      if (raw) setSavedNotes(JSON.parse(raw));
    } catch (err) {
      console.error("Impossibile caricare gli appunti salvati:", err);
    }
  }, []);

  const currentUsageKey = () => {
    const now = new Date();
    return `${USAGE_PREFIX}${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  };

  // Carica il conteggio dei caratteri usati questo mese
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(currentUsageKey());
      setMonthlyUsage(raw ? parseInt(raw, 10) || 0 : 0);
    } catch (err) {
      console.error("Impossibile caricare il contatore mensile:", err);
    }
  }, []);

  const addUsage = (chars) => {
    setMonthlyUsage((prev) => {
      const next = prev + chars;
      try {
        window.localStorage.setItem(currentUsageKey(), String(next));
      } catch (err) {
        console.error("Impossibile salvare il contatore mensile:", err);
      }
      return next;
    });
  };

  const persistNotes = (notes) => {
    setSavedNotes(notes);
    try {
      window.localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    } catch (err) {
      console.error("Impossibile salvare gli appunti:", err);
    }
  };

  const noteTitle = (text) => {
    const firstLine = text.trim().split("\n")[0] || "Senza titolo";
    return firstLine.length > 40 ? firstLine.slice(0, 40) + "…" : firstLine;
  };

  const saveNote = () => {
    if (!textDraft.trim()) return;
    if (activeNoteId) {
      // aggiorna un appunto esistente
      const updated = savedNotes.map((n) =>
        n.id === activeNoteId
          ? { ...n, text: textDraft, title: noteTitle(textDraft), updatedAt: Date.now() }
          : n
      );
      persistNotes(updated);
    } else {
      // crea un nuovo appunto
      const newNote = {
        id: Date.now().toString(),
        title: noteTitle(textDraft),
        text: textDraft,
        updatedAt: Date.now(),
      };
      persistNotes([newNote, ...savedNotes]);
      setActiveNoteId(newNote.id);
    }
  };

  const newNote = () => {
    setTextDraft("");
    setActiveNoteId(null);
  };

  const loadNote = (id) => {
    const note = savedNotes.find((n) => n.id === id);
    if (note) {
      setTextDraft(note.text);
      setActiveNoteId(note.id);
    }
  };

  const deleteNote = (id) => {
    persistNotes(savedNotes.filter((n) => n.id !== id));
    if (activeNoteId === id) {
      setTextDraft("");
      setActiveNoteId(null);
    }
  };

  const resetDocument = () => {
    setFileName(null);
    setChunks([]);
    setCurrentIndex(0);
    setIsPlaying(false);
    setStatus("In attesa di un documento");
    cacheRef.current = new Map();
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error("Impossibile cancellare il documento salvato:", err);
    }
  };

  const handleFile = useCallback(async (file) => {
    setError(null);
    setStatus("Estrazione del testo in corso…");
    resetDocument();
    setFileName(file.name);

    try {
      let text = "";
      const ext = file.name.split(".").pop().toLowerCase();

      if (ext === "docx") {
        const mammoth = (await import("mammoth")).default;
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        text = result.value;
      } else if (ext === "pdf") {
        const pdfjsLib = await import("pdfjs-dist/build/pdf");
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pageTexts = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items.map((it) => it.str).join(" ");
          pageTexts.push(pageText);
        }
        text = pageTexts.join("\n\n");
      } else {
        setError("Formato non supportato. Carica un file .docx o .pdf.");
        setStatus("In attesa di un documento");
        return;
      }

      const parts = splitIntoChunks(text);
      if (parts.length === 0) {
        setError("Non ho trovato testo leggibile in questo file.");
        setStatus("In attesa di un documento");
        return;
      }
      setChunks(parts);
      setStatus(`Pronto — ${parts.length} paragrafi · ${totalChars(parts).toLocaleString("it-IT")} caratteri totali`);
    } catch (err) {
      console.error(err);
      setError("Non sono riuscito a leggere questo file.");
      setStatus("In attesa di un documento");
    }
  }, []);

  const onDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const submitTypedText = () => {
    setError(null);
    if (!textDraft.trim()) {
      setError("Scrivi o detta prima un po' di testo.");
      return;
    }
    const parts = splitIntoChunks(textDraft);
    if (parts.length === 0) {
      setError("Non ho trovato testo leggibile.");
      return;
    }
    setFileName(null);
    setChunks(parts);
    setCurrentIndex(0);
    cacheRef.current = new Map();
    setStatus(`Pronto — ${parts.length} paragrafi · ${totalChars(parts).toLocaleString("it-IT")} caratteri totali`);
  };

  const synthesize = async (index) => {
    const key = `${voice}|${rate}|${index}`;
    if (cacheRef.current.has(key)) return cacheRef.current.get(key);

    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: chunks[index], voice, rate }),
    });
    if (!res.ok) throw new Error("Errore nella generazione audio");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    cacheRef.current.set(key, url);
    addUsage(chunks[index].length);
    return url;
  };

  const playChunk = async (index) => {
    if (index < 0 || index >= chunks.length) return;
    setError(null);
    setCurrentIndex(index);
    setIsLoading(true);
    setStatus("Preparazione della voce…");
    try {
      const url = await synthesize(index);
      if (audioRef.current) {
        audioRef.current.src = url;
        await audioRef.current.play();
        setIsPlaying(true);
        setStatus(`In ascolto — paragrafo ${index + 1} di ${chunks.length}`);
      }
    } catch (err) {
      console.error(err);
      setError("La voce non è disponibile in questo momento. Riprova.");
      setStatus("Pronto");
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlay = () => {
    if (!chunks.length) return;
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      setStatus("In pausa");
    } else if (audioRef.current?.src) {
      audioRef.current.play();
      setIsPlaying(true);
      setStatus(`In ascolto — paragrafo ${currentIndex + 1} di ${chunks.length}`);
    } else {
      playChunk(currentIndex);
    }
  };

  const onEnded = () => {
    if (autoAdvance && currentIndex < chunks.length - 1) {
      playChunk(currentIndex + 1);
    } else {
      setIsPlaying(false);
      setStatus("Lettura completata");
    }
  };

  return (
    <main className="page">
      <header className="hero">
        <p className="eyebrow">lettore vocale · voci neurali gratuite</p>
        <h1>Voce di Carta</h1>
        <p className="tagline">
          Carica un documento Word o PDF e ascoltalo con una voce maschile
          calda, senza cadenze meccaniche.
        </p>
      </header>

      <section className="dial-wrap" aria-label="Controllo di riproduzione">
        <div className={`dial ${isPlaying ? "dial--live" : ""}`}>
          <div className="dial__ring">
            {Array.from({ length: 24 }).map((_, i) => (
              <span
                key={i}
                className="dial__tick"
                style={{ transform: `rotate(${i * 15}deg)`, animationDelay: `${i * 0.05}s` }}
              />
            ))}
          </div>
          <button
            className="dial__play"
            onClick={togglePlay}
            disabled={!chunks.length || isLoading}
            aria-label={isPlaying ? "Metti in pausa" : "Avvia lettura"}
          >
            {isLoading ? "···" : isPlaying ? "❚❚" : "▶"}
          </button>
        </div>
        <p className="dial__status">{status}</p>
      </section>

      {error && <p className="alert">{error}</p>}

      <div className="mode-tabs">
        <button
          className={`mode-tab ${inputMode === "file" ? "mode-tab--active" : ""}`}
          onClick={() => setInputMode("file")}
        >
          Carica documento
        </button>
        <button
          className={`mode-tab ${inputMode === "text" ? "mode-tab--active" : ""}`}
          onClick={() => setInputMode("text")}
        >
          Scrivi o detta
        </button>
      </div>

      {inputMode === "file" ? (
        <section
          className="dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <label htmlFor="file-input" className="dropzone__label">
            <span className="dropzone__title">
              {fileName ? fileName : "Trascina qui un file .docx o .pdf"}
            </span>
            <span className="dropzone__hint">
              {fileName ? "Trascina un altro file per sostituirlo" : "oppure scegli dal computer"}
            </span>
          </label>
          <input
            id="file-input"
            type="file"
            accept=".docx,.pdf"
            onChange={onFileInput}
            hidden
          />
          {fileName && chunks.length > 0 && (
            <button className="clear-btn" onClick={resetDocument}>
              Rimuovi documento
            </button>
          )}
        </section>
      ) : (
        <section className="write-box">
          {savedNotes.length > 0 && (
            <div className="notes-list">
              {savedNotes.map((n) => (
                <div
                  key={n.id}
                  className={`note-chip ${activeNoteId === n.id ? "note-chip--active" : ""}`}
                >
                  <button className="note-chip__label" onClick={() => loadNote(n.id)}>
                    {n.title}
                  </button>
                  <button
                    className="note-chip__delete"
                    onClick={() => deleteNote(n.id)}
                    aria-label="Elimina appunto"
                    title="Elimina"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <textarea
            className="write-box__area"
            placeholder="Scrivi qui il testo, oppure detta con il microfono della tastiera…"
            value={textDraft}
            onChange={(e) => setTextDraft(e.target.value)}
            rows={8}
          />
          <div className="write-box__actions">
            <button
              className="write-box__submit"
              onClick={submitTypedText}
              disabled={!textDraft.trim()}
            >
              Prepara la lettura
            </button>
            <button
              className="write-box__save"
              onClick={saveNote}
              disabled={!textDraft.trim()}
            >
              {activeNoteId ? "Aggiorna" : "Salva come nuovo appunto"}
            </button>
            {textDraft && (
              <button className="clear-btn" onClick={newNote}>
                Nuovo appunto vuoto
              </button>
            )}
          </div>
          <p className="write-box__hint">
            🎙 Per dettare, usa il microfono della tastiera del telefono
            (l'icona vicino alla barra spazio) — funziona direttamente in
            questa casella, su Android e su iPhone.
          </p>
        </section>
      )}

      <section className="controls">
        <div className="control-group">
          <span className="control-label">Voce</span>
          <div className="pill-row">
            {VOICES.map((v) => (
              <button
                key={v.id}
                className={`pill ${voice === v.id ? "pill--active" : ""}`}
                onClick={() => {
                  setVoice(v.id);
                  cacheRef.current = new Map();
                }}
              >
                {v.label}
                <em>{v.note}</em>
              </button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <span className="control-label">Ritmo</span>
          <div className="pill-row">
            {RATES.map((r) => (
              <button
                key={r.id}
                className={`pill ${rate === r.id ? "pill--active" : ""}`}
                onClick={() => {
                  setRate(r.id);
                  cacheRef.current = new Map();
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={autoAdvance}
            onChange={(e) => setAutoAdvance(e.target.checked)}
          />
          Continua automaticamente al paragrafo successivo
        </label>
      </section>

      {chunks.length > 0 && (
        <section className="tracklist" aria-label="Paragrafi del documento">
          {chunks.map((c, i) => (
            <button
              key={i}
              className={`track ${i === currentIndex ? "track--active" : ""}`}
              onClick={() => playChunk(i)}
            >
              <span className="track__index">{String(i + 1).padStart(2, "0")}</span>
              <span className="track__excerpt">{c.slice(0, 110)}{c.length > 110 ? "…" : ""}</span>
            </button>
          ))}
        </section>
      )}

      <audio ref={audioRef} onEnded={onEnded} hidden />

      <div className="usage-meter">
        <div className="usage-meter__bar">
          <div
            className="usage-meter__fill"
            style={{ width: `${Math.min(100, (monthlyUsage / MONTHLY_LIMIT) * 100)}%` }}
          />
        </div>
        <p className="usage-meter__label">
          {monthlyUsage.toLocaleString("it-IT")} di {MONTHLY_LIMIT.toLocaleString("it-IT")} caratteri usati questo mese (stima)
        </p>
      </div>

      <footer className="footnote">
        Le voci sono generate tramite voci neurali gratuite — nessun costo,
        nessuna registrazione richiesta.
      </footer>
    </main>
  );
}
