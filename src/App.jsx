import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Heart, Plus, QrCode, Users, ArrowLeft } from "lucide-react";

const categories = ["Confession", "Memory", "Regret", "Hope", "Funny Thought"];
const names = ["Quiet Stranger", "Night Walker", "Lost Signal", "Wet Shoes", "Small Flame", "Window Ghost", "Soft Static"];
const roomThemes = ["Forest Fire", "Rainy Rooftop", "Snowfire", "Desert Night", "CRT Night"];

function randomName() {
  return names[Math.floor(Math.random() * names.length)];
}

function moodFromCategory(category) {
  if (category === "Hope") return "hope";
  if (category === "Regret") return "smoke";
  if (category === "Memory") return "rain";
  if (category === "Funny Thought") return "sparks";
  return "neutral";
}

function AmbientBackground({ mood = "neutral" }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#050407]">
      <motion.div
        animate={{ opacity: [0.35, 0.7, 0.35], scale: [1, 1.12, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        className={`absolute left-1/2 top-1/2 h-[44rem] w-[44rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px] ${
          mood === "hope" ? "bg-orange-400/25" : mood === "rain" ? "bg-blue-500/12" : "bg-orange-600/18"
        }`}
      />
      <motion.div
        animate={{ x: [-80, 60, -80], opacity: [0.12, 0.25, 0.12] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="absolute left-[-10%] top-[8%] h-96 w-96 rounded-full bg-purple-500/10 blur-[100px]"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,.25)_42%,rgba(0,0,0,.86)_100%)]" />
      {mood === "rain" && <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(115deg,rgba(147,197,253,.22)_1px,transparent_1px)] [background-size:64px_64px]" />}
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-overlay [background-image:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:4px_4px]" />
    </div>
  );
}

function Campfire({ mood = "neutral", small = false }) {
  const sparks = mood === "sparks" ? 34 : 18;
  const smoke = mood === "smoke" ? 14 : 7;
  return (
    <div className={`pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 ${small ? "h-72 w-72" : "h-[34rem] w-[34rem]"}`}>
      <motion.div animate={{ scale: [0.96, 1.1, 0.96], opacity: [0.32, 0.62, 0.32] }} transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }} className="absolute inset-0 rounded-full bg-orange-500/20 blur-[90px]" />
      <div className="absolute left-1/2 top-1/2 h-64 w-56 -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_0_45px_rgba(251,146,60,.65)]">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ scaleY: [0.85, 1.2, 0.9], scaleX: [1, 0.78, 1.06], rotate: [-4 + i * 4, 4 - i * 2, -4 + i * 4], opacity: [0.72, 1, 0.78] }}
            transition={{ duration: 0.9 + i * 0.22, repeat: Infinity, ease: "easeInOut" }}
            className={`absolute bottom-12 left-1/2 origin-bottom -translate-x-1/2 rounded-t-full rounded-bl-full ${i === 0 ? "h-48 w-32 bg-orange-600" : i === 1 ? "h-40 w-24 bg-amber-300 mix-blend-screen" : "h-28 w-16 bg-yellow-100 mix-blend-screen"}`}
          />
        ))}
        <div className="absolute bottom-8 left-1/2 h-5 w-56 -translate-x-1/2 rotate-6 rounded-full bg-stone-950" />
        <div className="absolute bottom-8 left-1/2 h-5 w-56 -translate-x-1/2 -rotate-6 rounded-full bg-stone-900" />
      </div>
      {Array.from({ length: sparks }).map((_, i) => (
        <motion.span key={i} animate={{ y: [-20, -230 - (i % 5) * 22], x: [0, (i % 2 ? 1 : -1) * (18 + i * 2)], opacity: [0, 1, 0] }} transition={{ duration: 2.4 + (i % 4), delay: i * 0.09, repeat: Infinity, ease: "easeOut" }} className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-orange-200 shadow-[0_0_14px_rgba(251,191,36,.95)]" />
      ))}
      {Array.from({ length: smoke }).map((_, i) => (
        <motion.span key={`smoke-${i}`} animate={{ y: [-10, -280], x: [0, i % 2 ? 60 : -60], opacity: [0, mood === "smoke" ? 0.28 : 0.13, 0] }} transition={{ duration: 8 + i * 0.4, delay: i * 0.5, repeat: Infinity, ease: "easeOut" }} className="absolute left-1/2 top-[44%] h-24 w-24 rounded-full bg-stone-300/10 blur-2xl" />
      ))}
    </div>
  );
}

function FloatingMessage({ message, onWarmth }) {
  const left = useMemo(() => 16 + Math.random() * 68, []);
  return (
    <motion.article
      initial={{ opacity: 0, y: 120, scale: 0.92 }}
      animate={{ opacity: [0, 1, 0.94, 0], y: -430, scale: [0.92, 1, 0.98] }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 18, ease: "linear" }}
      className="pointer-events-auto absolute bottom-[30%] z-20 max-w-[280px] rounded-3xl border border-orange-100/10 bg-black/28 p-4 text-orange-50/85 shadow-[0_0_35px_rgba(251,146,60,.18)] backdrop-blur-xl"
      style={{ left: `${left}%` }}
    >
      <p className="text-[10px] uppercase tracking-[0.28em] text-orange-200/35">{message.name}</p>
      <p className="mt-2 text-sm leading-6">{message.text}</p>
      <button onClick={() => onWarmth(message.id)} className="mt-4 flex items-center gap-2 rounded-full border border-orange-100/10 bg-orange-100/5 px-3 py-2 text-xs text-orange-100/55 transition hover:bg-orange-100/10">
        <Heart className="h-3 w-3" /> {message.warmth > 0 ? `${message.warmth} strangers sent warmth` : "Send warmth"}
      </button>
    </motion.article>
  );
}

function FireRoom({ roomName, prompt, onBack }) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState("Confession");
  const [messages, setMessages] = useState([
    { id: 1, text: "I wish people knew how tired I am, even when I look okay.", category: "Memory", name: "Window Ghost", warmth: 2 },
    { id: 2, text: "A small part of me still believes things can get lighter.", category: "Hope", name: "Quiet Stranger", warmth: 4 },
  ]);
  const mood = moodFromCategory(messages[messages.length - 1]?.category || category);

  function throwMessage(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const id = Date.now();
    setMessages((current) => [...current.slice(-8), { id, text: text.trim(), category, name: randomName(), warmth: 0 }]);
    setText("");
    window.setTimeout(() => setMessages((current) => current.filter((m) => m.id !== id)), 18500);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050407] text-orange-50">
      <AmbientBackground mood={mood} />
      <Campfire mood={mood} />
      <button onClick={onBack} className="absolute left-5 top-5 z-50 flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-4 py-2 text-sm text-orange-100/65 backdrop-blur-xl hover:bg-white/5"><ArrowLeft className="h-4 w-4" /> Home</button>
      <div className="pointer-events-none absolute left-1/2 top-8 z-30 -translate-x-1/2 text-center">
        <p className="text-xs uppercase tracking-[0.55em] text-orange-200/40">{roomName}</p>
        <p className="mt-3 text-sm text-orange-100/45">{prompt}</p>
      </div>
      <div className="absolute inset-0 z-10 overflow-hidden"><AnimatePresence>{messages.map((m) => <FloatingMessage key={m.id} message={m} onWarmth={(id) => setMessages((cur) => cur.map((x) => x.id === id ? { ...x, warmth: x.warmth + 1 } : x))} />)}</AnimatePresence></div>
      <form onSubmit={throwMessage} className="absolute inset-x-0 bottom-0 z-40 mx-auto max-w-4xl px-4 pb-5 md:pb-8">
        <div className="rounded-[2rem] border border-orange-100/10 bg-black/30 p-3 shadow-[0_0_80px_rgba(249,115,22,.16)] backdrop-blur-2xl md:p-4">
          <div className="flex flex-wrap gap-2 px-1 pb-3">{categories.map((item) => <button type="button" key={item} onClick={() => setCategory(item)} className={`rounded-full border px-3 py-2 text-xs transition md:px-4 ${category === item ? "border-orange-200/35 bg-orange-200/15 text-orange-50" : "border-white/10 bg-white/[.03] text-orange-100/45 hover:bg-white/[.06]"}`}>{item}</button>)}</div>
          <div className="flex flex-col gap-3 md:flex-row"><textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 280))} placeholder="What do you want to let go of?" rows={2} className="min-h-20 flex-1 resize-none rounded-[1.4rem] border border-white/10 bg-white/[.04] px-5 py-4 text-base leading-7 text-orange-50 outline-none placeholder:text-orange-100/30 focus:border-orange-200/25" /><motion.button whileTap={{ scale: 0.98 }} className="flex items-center justify-center gap-2 rounded-[1.4rem] bg-orange-300/90 px-6 py-4 text-sm font-medium uppercase tracking-[0.2em] text-stone-950 shadow-[0_0_40px_rgba(251,146,60,.35)] transition hover:bg-orange-200 md:w-56"><Flame className="h-4 w-4" /> Throw into Fire</motion.button></div>
          <div className="mt-3 flex items-center justify-between px-2 text-xs text-orange-100/35"><span>No accounts. No profiles. Just this moment.</span><span>{text.length}/280</span></div>
        </div>
      </form>
    </main>
  );
}

function CreateFireModal({ onClose, onCreate }) {
  const [name, setName] = useState("Class Reflection Fire");
  const [prompt, setPrompt] = useState("What is something people should understand about you today?");
  const [theme, setTheme] = useState("Rainy Rooftop");

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 px-5 backdrop-blur-xl">
      <motion.div initial={{ y: 24, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 24, opacity: 0, scale: 0.96 }} className="w-full max-w-xl rounded-[2rem] border border-orange-100/10 bg-[#0b0708]/85 p-6 text-orange-50 shadow-[0_0_100px_rgba(249,115,22,.22)]">
        <p className="text-xs uppercase tracking-[0.45em] text-orange-200/40">Create your own fire</p>
        <h2 className="mt-4 text-3xl font-light tracking-[-0.04em]">A private campfire for your group.</h2>
        <div className="mt-6 space-y-4">
          <label className="block text-sm text-orange-100/50">Fire name<input value={name} onChange={(e) => setName(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[.04] px-4 py-3 text-orange-50 outline-none" /></label>
          <label className="block text-sm text-orange-100/50">Prompt<textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-white/[.04] px-4 py-3 text-orange-50 outline-none" /></label>
          <div><p className="text-sm text-orange-100/50">Theme</p><div className="mt-2 flex flex-wrap gap-2">{roomThemes.map((t) => <button key={t} onClick={() => setTheme(t)} className={`rounded-full border px-3 py-2 text-xs ${theme === t ? "border-orange-200/35 bg-orange-200/15" : "border-white/10 bg-white/[.03] text-orange-100/45"}`}>{t}</button>)}</div></div>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-3"><button onClick={onClose} className="rounded-2xl border border-white/10 px-5 py-3 text-orange-100/55 hover:bg-white/5">Cancel</button><button onClick={() => onCreate({ name, prompt })} className="rounded-2xl bg-orange-300 px-5 py-3 font-medium text-stone-950 hover:bg-orange-200">Create Fire</button></div>
      </motion.div>
    </motion.div>
  );
}

export default function DigitalCampfireHomepage() {
  const [view, setView] = useState("home");
  const [modal, setModal] = useState(false);
  const [room, setRoom] = useState({ name: "Digital Campfire", prompt: "Throw a thought into the fire." });

  if (view === "fire") return <FireRoom roomName={room.name} prompt={room.prompt} onBack={() => setView("home")} />;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050407] px-5 text-orange-50">
      <AmbientBackground mood="neutral" />
      <Campfire mood="neutral" small />
      <div className="relative z-30 mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center py-10">
        <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }} className="max-w-4xl text-center">
          <p className="mb-5 text-xs uppercase tracking-[0.5em] text-orange-200/55">anonymous / temporary / warm</p>
          <h1 className="text-6xl font-light tracking-[-0.08em] drop-shadow-[0_0_30px_rgba(251,146,60,.45)] md:text-8xl">Digital Campfire</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-orange-100/70 md:text-xl">A quiet corner of the internet where strangers and groups leave pieces of themselves in the fire.</p>
          <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button onClick={() => { setRoom({ name: "Main Public Fire", prompt: "Throw a thought into the fire." }); setView("fire"); }} className="rounded-full bg-orange-300 px-8 py-4 text-sm font-medium uppercase tracking-[0.24em] text-stone-950 shadow-[0_0_70px_rgba(249,115,22,.28)] transition hover:bg-orange-200"><Flame className="mr-2 inline h-4 w-4" /> Join Main Fire</button>
            <button onClick={() => setModal(true)} className="rounded-full border border-orange-200/20 bg-orange-300/10 px-8 py-4 text-sm uppercase tracking-[0.24em] text-orange-100 backdrop-blur-xl transition hover:bg-orange-300/15"><Plus className="mr-2 inline h-4 w-4" /> Create Campfire</button>
          </div>
        </motion.section>

        <section className="mt-16 grid w-full gap-4 md:grid-cols-3">
          <div className="rounded-[2rem] border border-orange-100/10 bg-black/24 p-6 backdrop-blur-xl"><Users className="mb-5 h-5 w-5 text-orange-200/55" /><h3 className="text-xl font-light">Public Fire</h3><p className="mt-3 text-sm leading-6 text-orange-100/50">Everyone can join, write anonymously, send warmth, and watch thoughts fade into embers.</p></div>
          <div className="rounded-[2rem] border border-orange-100/10 bg-black/24 p-6 backdrop-blur-xl"><QrCode className="mb-5 h-5 w-5 text-orange-200/55" /><h3 className="text-xl font-light">Private Fires</h3><p className="mt-3 text-sm leading-6 text-orange-100/50">Create a temporary room with a prompt, link, and QR code for workshops, teams, or school classes.</p></div>
          <div className="rounded-[2rem] border border-orange-100/10 bg-black/24 p-6 backdrop-blur-xl"><Heart className="mb-5 h-5 w-5 text-orange-200/55" /><h3 className="text-xl font-light">Warmth, not likes</h3><p className="mt-3 text-sm leading-6 text-orange-100/50">No profiles, no followers, no feed. Just quiet presence and emotional connection.</p></div>
        </section>
      </div>
      <AnimatePresence>{modal && <CreateFireModal onClose={() => setModal(false)} onCreate={(newRoom) => { setRoom({ name: newRoom.name, prompt: newRoom.prompt }); setModal(false); setView("fire"); }} />}</AnimatePresence>
    </main>
  );
}
