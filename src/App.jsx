import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Flame,
  Heart,
  Loader2,
  Plus,
  QrCode,
  Users,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

// 1. IMPORT DES BESTEHENDEN SUPABASE CLIENTS
import { supabase } from "./supabaseClient";

/* HINWEIS FÜR DEN FALLBACK (Falls du keinen separaten Client hast):
  Falls du den Client direkt hier initialisieren willst, kommentiere die obere Zeile aus
  und aktiviere diesen Block:

  import { createClient } from "@supabase/supabase-js";
  const getSessionId = () => {
    if (typeof window === "undefined") return "";
    let id = window.localStorage.getItem("campfire_session_id");
    if (!id) {
      id = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      window.localStorage.setItem("campfire_session_id", id);
    }
    return id;
  };
  const localSessionId = getSessionId();
  export const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL || "", 
    import.meta.env.VITE_SUPABASE_ANON_KEY || "", 
    { global: { headers: { "x-client-session-id": localSessionId } } }
  );
*/

// --- Globale Konstanten ---
const categories = ["Confession", "Memory", "Regret", "Hope", "Funny Thought"];
const adjectives = ["Silent", "Dreaming", "Wild", "Cozy", "Lonely", "Cheerful", "Gentle", "Golden"];
const nouns = ["Fox", "Spark", "Wanderer", "Wolf", "Star", "Ghost", "Deer", "Owl", "Smoke", "Ember"];
const PUBLIC_ROOM = {
  id: null,
  slug: null,
  name: "Main Public Fire",
  prompt: "Throw a thought into the fire.",
  theme: "Forest Fire",
};

const FLOW_INTERVAL = 3000;
const PUBLIC_POLL_INTERVAL = 30000;
const MAX_QUEUE_ITEMS = 50;
const MAX_VISIBLE_MESSAGES = 10;
const MAX_TEXT_LENGTH = 140;
const TOAST_DURATION = 4000;

const DEFAULT_POOL = [
  { id: "def-1", name: "Cozy Spark", text: "The fire crackles gently. Welcome traveler.", category: "Hope", warmth: 12, is_permanent: true },
  { id: "def-2", name: "Silent Wanderer", text: "Some regrets are just stepping stones.", category: "Regret", warmth: 4, is_permanent: true },
  { id: "def-3", name: "Dreaming Owl", text: "Remember the night under the stars?", category: "Memory", warmth: 19, is_permanent: true },
  { id: "def-4", name: "Gentle Smoke", text: "Anonymity gives us the courage to be honest.", category: "Confession", warmth: 8, is_permanent: true },
];

function generateLagerfeuerName() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj} ${noun}`;
}

function safeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
}

function normalizeText(value) {
  return String(value || "").trim();
}

function getSeed(value) {
  return String(value || "").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function moodFromCategory(category) {
  if (category === "Hope") return "hope";
  if (category === "Regret") return "smoke";
  if (category === "Memory") return "rain";
  if (category === "Funny Thought") return "sparks";
  return "neutral";
}

function buildRuntimeMessage(message, lastLaneRef) {
  const seed = getSeed(message.id || message.client_token);
  const lanes = [8, 24, 62, 78];
  let laneIndex = seed % lanes.length;
  if (laneIndex === lastLaneRef.current) laneIndex = (laneIndex + 1) % lanes.length;
  lastLaneRef.current = laneIndex;

  const randomOffset = (seed % 7) - 3;
  return {
    ...message,
    runtimeId: `${message.id || message.client_token}-${Date.now()}-${Math.random()}`,
    x: Math.max(4, Math.min(92, lanes[laneIndex] + randomOffset)),
    xOffset: (seed % 21) - 10,
    sway: 12 + (seed % 20),
    drift: (seed % 2 === 0 ? 1 : -1) * (10 + (seed % 20)),
  };
}

export default function DigitalCampfire() {
  const [view, setView] = useState("home");
  const [activeRoom, setActiveRoom] = useState(PUBLIC_ROOM);
  const [adminToken, setAdminToken] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [errorToast, setErrorToast] = useState(null);
  const [activeMood, setActiveMood] = useState("Hope");
  const [showAbout, setShowAbout] = useState(false);

  const toastTimerRef = useRef(null);

  const currentSessionId = useMemo(() => {
    if (typeof window === "undefined") return "";
    let id = window.localStorage.getItem("campfire_session_id");
    if (!id) {
      id = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      window.localStorage.setItem("campfire_session_id", id);
    }
    return id;
  }, []);

  const triggerToast = useCallback((message) => {
    setErrorToast(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setErrorToast(null), TOAST_DURATION);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const fetchRoomBySlug = useCallback(async (slug, token) => {
    try {
      const { data, error } = await supabase.from("rooms").select("*").eq("slug", slug).single();
      if (error || !data) {
        triggerToast("The requested fire could not be found or has expired.");
        setView("home");
        return;
      }

      setActiveRoom(data);
      setView("fire");

      if (token) {
        const { data: adminCheck, error: adminError } = await supabase.rpc("is_room_admin", {
          room_id_input: data.id,
          admin_token_input: token,
        });
        if (!adminError && adminCheck) {
          setIsAdmin(true);
        }
      }
    } catch (err) {
      console.error("Room resolution failed:", err);
      triggerToast("Error loading the fire.");
      setView("home");
    }
  }, [triggerToast]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomSlug = params.get("room");
    const token = params.get("admin") || params.get("adminToken") || null;

    if (roomSlug) {
      setAdminToken(token);
      fetchRoomBySlug(roomSlug, token);
    }
  }, [fetchRoomBySlug]);

  const handleLeaveRoom = useCallback(() => {
    window.history.pushState({}, "", window.location.pathname);
    setActiveRoom(PUBLIC_ROOM);
    setAdminToken(null);
    setIsAdmin(false);
    setView("home");
  }, []);

  const handleJoinPublic = useCallback(() => {
    window.history.pushState({}, "", window.location.pathname);
    setActiveRoom(PUBLIC_ROOM);
    setAdminToken(null);
    setIsAdmin(false);
    setView("fire");
  }, []);

  if (view === "home") {
    return (
      <>
        {showAbout && <AboutPage onClose={() => setShowAbout(false)} />}
        <Dashboard
        onJoinPublic={handleJoinPublic}
        onRoomLoaded={(room, token) => {
          setActiveRoom(room);
          setAdminToken(token);
          setIsAdmin(true);
          setView("fire");
        }}
        triggerToast={triggerToast}
        onAbout={() => setShowAbout(true)}
      />
      </>
    );
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black font-sans text-orange-50 antialiased selection:bg-orange-500/30">
      <AmbientBackground mood={activeMood} />
      <FireRoom
        room={activeRoom}
        adminToken={adminToken}
        isAdmin={isAdmin}
        onLeave={handleLeaveRoom}
        triggerToast={triggerToast}
        sessionId={currentSessionId}
        setActiveMood={setActiveMood}
        activeMood={activeMood}
        onAbout={() => setShowAbout(true)}
      />
      <AnimatePresence>
        {errorToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl border border-red-500/30 bg-neutral-900/95 px-5 py-4 text-sm text-red-200 shadow-2xl backdrop-blur-xl"
            role="status"
          >
            <div className="mb-1 font-semibold tracking-wide text-red-400">Fire Notice</div>
            <p className="leading-relaxed text-red-200/80">{errorToast}</p>
          </motion.div>
        )}
      </AnimatePresence>
    {showAbout && <AboutPage onClose={() => setShowAbout(false)} />}
    </div>
  );
}

const AmbientBackground = memo(function AmbientBackground({ mood }) {
  const bgStyles = useMemo(() => {
    switch (mood) {
      case "Regret": return "from-neutral-950 via-neutral-900 to-indigo-950/30";
      case "Memory": return "from-neutral-950 via-stone-900 to-amber-950/20";
      case "Confession": return "from-neutral-950 via-neutral-900 to-purple-950/30";
      case "Funny Thought": return "from-neutral-950 via-neutral-900 to-yellow-950/10";
      default: return "from-neutral-950 via-neutral-900 to-orange-950/20";
    }
  }, [mood]);

  return (
    <div className={`absolute inset-0 z-0 bg-gradient-to-tr ${bgStyles} transition-all duration-[4000ms] ease-in-out`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.8)_100%)]" />
    </div>
  );
});

function Dashboard({ onJoinPublic, onRoomLoaded, triggerToast, onAbout }) {
  const [roomName, setRoomName] = useState("");
  const [roomPrompt, setRoomPrompt] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    const name = normalizeText(roomName);
    const prompt = normalizeText(roomPrompt);

    if (!name || !prompt) {
      triggerToast("Please enter a fire name and a prompt.");
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase.rpc("create_campfire_room", {
        room_name: name,
        room_prompt: prompt,
        room_theme: "Forest Fire",
      });

      if (error || !data || data.length === 0) {
        throw new Error(error?.message || "Error creating the fire.");
      }

      const createdRoom = data[0];
      const adminUrl = `${window.location.origin}${window.location.pathname}?room=${createdRoom.slug}&admin=${createdRoom.admin_token}`;
      window.history.pushState({}, "", adminUrl);

      onRoomLoaded({
        id: createdRoom.id,
        slug: createdRoom.slug,
        name,
        prompt,
        theme: "Forest Fire",
        expires_at: createdRoom.expires_at,
      }, createdRoom.admin_token);
    } catch (err) {
      console.error("Room creation failed:", err);
      triggerToast(err.message || "The fire could not be created.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full select-none flex-col justify-between overflow-y-auto bg-neutral-950 p-6 text-orange-50 md:p-12">
      <div className="mx-auto my-auto w-full max-w-md space-y-8 rounded-[2.5rem] border border-orange-500/10 bg-gradient-to-b from-neutral-900/40 to-neutral-900/10 p-8 shadow-2xl backdrop-blur-2xl">
        <div className="text-center">
          <Flame className="mx-auto h-12 w-12 animate-pulse text-orange-500" />
          <h2 className="mt-4 text-3xl font-light tracking-tight">Digital Campfire</h2>
          <p className="mt-2 text-sm text-orange-200/50">An anonymous, meditative space for thoughts.</p>
        </div>

        <button onClick={onJoinPublic} className="w-full rounded-2xl bg-orange-600 py-4 font-medium text-white shadow-lg shadow-orange-950/50 transition-all hover:bg-orange-500 active:scale-[0.98]">
          Join Public Fire
        </button>

        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-orange-500/10" />
          <span className="mx-4 flex-shrink text-xs uppercase tracking-widest text-orange-200/30">or create a private fire</span>
          <div className="flex-grow border-t border-orange-500/10" />
        </div>

        <form onSubmit={handleCreateRoom} className="space-y-4">
          <input
            type="text"
            placeholder="Fire name (e.g. Team Offsite)"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value.slice(0, 80))}
            className="w-full rounded-xl border border-orange-500/10 bg-black/40 px-4 py-3 text-sm text-orange-100 placeholder-neutral-600 transition-colors focus:border-orange-500/40 focus:outline-none"
          />
          <input
            type="text"
            placeholder="Prompt (e.g. What's on your mind?)"
            value={roomPrompt}
            onChange={(e) => setRoomPrompt(e.target.value.slice(0, 240))}
            className="w-full rounded-xl border border-orange-500/10 bg-black/40 px-4 py-3 text-sm text-orange-100 placeholder-neutral-600 transition-colors focus:border-orange-500/40 focus:outline-none"
          />

          <button
            type="submit"
            disabled={isCreating}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-orange-500/20 bg-neutral-800 py-3 font-medium text-orange-200 transition-colors hover:bg-neutral-700 disabled:opacity-40"
          >
            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create Private Fire
          </button>
        </form>
      </div>

      <div className="relative z-30 mx-auto mt-12 grid w-full max-w-5xl gap-4 md:grid-cols-3">
        <div className="rounded-[2rem] border border-orange-100/10 bg-black/20 p-6 backdrop-blur-xl">
          <Users className="mb-4 h-5 w-5 text-orange-400" />
          <h3 className="text-lg font-normal">Public Polling Architecture</h3>
          <p className="mt-2 text-xs leading-relaxed text-orange-100/50">The main room uses no WebSockets. Aggregated polling protects the database from unlimited connections.</p>
        </div>
        <div className="rounded-[2rem] border border-orange-100/10 bg-black/20 p-6 backdrop-blur-xl">
          <QrCode className="mb-4 h-5 w-5 text-orange-400" />
          <h3 className="text-lg font-normal">Isolated Realtime Multiplexing</h3>
          <p className="mt-2 text-xs leading-relaxed text-orange-100/50">Private rooms use isolated realtime connections for synchronous collaboration in workshops and classrooms.</p>
        </div>
        <div className="rounded-[2rem] border border-orange-100/10 bg-black/20 p-6 backdrop-blur-xl">
          <Heart className="mb-4 h-5 w-5 text-orange-400" />
          <h3 className="text-lg font-normal">Security & Shadow Protection</h3>
          <p className="mt-2 text-xs leading-relaxed text-orange-100/50">Heuristic client-side defenses combined with cryptographic tokens prevent malicious overload and denial of service.</p>
        </div>
      </div>
      <Footer onAbout={onAbout} />
    </div>
  );
}

function FireRoom({ room, adminToken, isAdmin, onLeave, triggerToast, sessionId, setActiveMood, activeMood, onAbout }) {
  const isPublic = room.id === null;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [category, setCategory] = useState("Hope");
  const [showQrModal, setShowQrModal] = useState(false);
  const warmthBusyIdsRef = useRef(new Set());

  const poolPermanentRef = useRef(isPublic ? [...DEFAULT_POOL] : []);
  const poolUserRef = useRef([]);
  const lastLaneRef = useRef(-1);
  const flowIndexRef = useRef(0);
  const seenIdsRef = useRef(new Set());
  
  const optimisticMapRef = useRef(new Map());

  const shareUrl = useMemo(() => {
    if (!room.slug) return window.location.origin + window.location.pathname;
    return `${window.location.origin}${window.location.pathname}?room=${room.slug}`;
  }, [room.slug]);

  const adminUrl = useMemo(() => {
    if (!room.slug || !adminToken) return "";
    return `${window.location.origin}${window.location.pathname}?room=${room.slug}&admin=${adminToken}`;
  }, [adminToken, room.slug]);

  const checkRateLimit = useCallback(() => {
    try {
      const now = Date.now();
      const records = JSON.parse(localStorage.getItem("campfire_rate_records") || "[]");
      const oneHourAgo = now - 3600000;
      const validRecords = records.filter(time => time > oneHourAgo);

      if (validRecords.length >= 20) {
        triggerToast("You've reached the hourly limit. The fire needs a moment of rest.");
        return { allowed: false, records: validRecords };
      }

      if (validRecords.length > 0) {
        const lastTime = validRecords[validRecords.length - 1];
        const minDistance = isPublic ? 10000 : 5000; 
        if (now - lastTime < minDistance) {
          const waitSec = Math.ceil((minDistance - (now - lastTime)) / 1000);
          triggerToast(`Please wait ${waitSec} more seconds before throwing another thought into the fire.`);
          return { allowed: false, records: validRecords };
        }
      }

      return { allowed: true, records: validRecords };
    } catch (e) {
      return { allowed: true, records: [] };
    }
  }, [isPublic, triggerToast]);

  const commitRateLimit = useCallback((currentRecords) => {
    try {
      const updated = [...currentRecords, Date.now()];
      localStorage.setItem("campfire_rate_records", JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to commit rate-limit to storage", e);
    }
  }, []);

  const runShadowModeration = useCallback((rawText) => {
    const input = rawText.toLowerCase();
    
    const urlPattern = /https?:\/\/[^\s]+|www\.[^\s]+/i;
    if (urlPattern.test(input)) return "shadow_blocked";

    const repetitionPattern = /(.)\1{7,}/;
    if (repetitionPattern.test(input)) return "shadow_blocked";

    if (rawText.length > 8) {
      const capsCount = rawText.replace(/[^A-Z]/g, "").length;
      if (capsCount / rawText.length > 0.65) return "shadow_blocked";
    }

    const blacklisted = ["crypto", "onlyfans", "telegram", "buy now", "solana", "bitcoin"];
    if (blacklisted.some(token => input.includes(token))) {
      return "shadow_blocked";
    }

    return "approved";
  }, []);

  const enqueueUserMessages = useCallback((incomingMessages) => {
    const fresh = [];

    incomingMessages.forEach((msg) => {
      if (!msg?.id) return;

      const token = msg.client_token;
      if (token && optimisticMapRef.current.has(token)) {
        const matchingRuntimeId = optimisticMapRef.current.get(token);
        optimisticMapRef.current.delete(token);

        setMessages((current) =>
          current.map((visible) =>
            visible.runtimeId === matchingRuntimeId
              ? { ...visible, ...msg, isOptimistic: false }
              : visible
          )
        );
        seenIdsRef.current.add(msg.id);
        return;
      }

      if (seenIdsRef.current.has(msg.id)) return;
      seenIdsRef.current.add(msg.id);
      fresh.push(msg);
    });

    if (fresh.length > 0) {
      poolUserRef.current = [...poolUserRef.current, ...fresh].slice(-MAX_QUEUE_ITEMS);
    }
  }, []);

  const fetchPublicSnapshot = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("get_public_campfire_feed");
      if (error) throw error;
      enqueueUserMessages([...(data || [])].reverse());
    } catch (err) {
      console.error("Public feed rpc polling sync error:", err);
    }
  }, [enqueueUserMessages]);

  const fetchPrivateInitial = useCallback(async () => {
    if (!room.id) return;
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("room_id", room.id)
        .order("created_at", { ascending: false })
        .limit(40);

      if (error) throw error;
      enqueueUserMessages([...(data || [])].reverse());
    } catch (err) {
      console.error("Private room snapshot error:", err);
      triggerToast("Private messages could not be loaded.");
    }
  }, [enqueueUserMessages, room.id, triggerToast]);

  useEffect(() => {
    setMessages([]);
    poolUserRef.current = [];
    poolPermanentRef.current = isPublic ? [...DEFAULT_POOL] : [];
    seenIdsRef.current = new Set();
    optimisticMapRef.current.clear();
    lastLaneRef.current = -1;
    flowIndexRef.current = 0;
  }, [room.id]);

  useEffect(() => {
    if (isPublic) {
      fetchPublicSnapshot();
      const intervalId = window.setInterval(fetchPublicSnapshot, PUBLIC_POLL_INTERVAL);
      return () => window.clearInterval(intervalId);
    }

    fetchPrivateInitial();

    const channel = supabase
      .channel(`room_sync_${room.id}`)
      .on("postgres_changes", { event: "INSERT", filter: `room_id=eq.${room.id}`, schema: "public", table: "messages" }, (payload) => {
        enqueueUserMessages([payload.new]);
      })
      .on("postgres_changes", { event: "UPDATE", filter: `room_id=eq.${room.id}`, schema: "public", table: "messages" }, (payload) => {
        const updated = payload.new;
        setMessages((current) =>
          current.map((msg) => msg.id === updated.id ? { ...msg, warmth: updated.warmth } : msg)
        );
        poolUserRef.current = poolUserRef.current.map((msg) =>
          msg.id === updated.id ? { ...msg, warmth: updated.warmth } : msg
        );
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enqueueUserMessages, fetchPrivateInitial, fetchPublicSnapshot, isPublic, room.id]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      let nextMessage = null;

      if (poolUserRef.current.length > 0) {
        nextMessage = poolUserRef.current.shift();
      } else if (poolPermanentRef.current.length > 0) {
        nextMessage = poolPermanentRef.current[flowIndexRef.current % poolPermanentRef.current.length];
        flowIndexRef.current += 1;
      }

      if (!nextMessage) return;

      const runtimeMessage = buildRuntimeMessage(nextMessage, lastLaneRef);
      setMessages((prev) => [...prev.slice(-(MAX_VISIBLE_MESSAGES - 1)), runtimeMessage]);
      setActiveMood(runtimeMessage.category || "Hope");
    }, FLOW_INTERVAL);

    return () => window.clearInterval(timerId);
  }, [setActiveMood]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const messageText = normalizeText(text);
    if (!messageText) return;

    if (messageText.length > MAX_TEXT_LENGTH) {
      triggerToast("The fire rejected your message (max. 140 characters).");
      return;
    }

    const limitStatus = checkRateLimit();
    if (!limitStatus.allowed) return;

    const currentCategory = category;
    const currentAuthor = generateLagerfeuerName();
    const token = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    const modStatus = runShadowModeration(messageText);

    setText("");

    const optimisticMessage = {
      id: `optimistic-${token}`,
      client_token: token,
      name: currentAuthor,
      text: messageText,
      category: currentCategory,
      warmth: 0,
      room_id: room.id,
      session_id: sessionId,
      is_permanent: false,
      isOptimistic: true,
      moderation_status: modStatus,
      created_at: new Date().toISOString(),
    };

    const runtimeOptimistic = buildRuntimeMessage(optimisticMessage, lastLaneRef);
    optimisticMapRef.current.set(token, runtimeOptimistic.runtimeId);
    
    setMessages((prev) => [...prev.slice(-(MAX_VISIBLE_MESSAGES - 1)), runtimeOptimistic]);
    setActiveMood(currentCategory);

    try {
      const { data, error } = await supabase
        .from("messages")
        .insert([
          {
            room_id: room.id,
            name: currentAuthor,
            text: messageText,
            category: currentCategory,
            session_id: sessionId,
            client_token: token,
            warmth: 0,
            is_permanent: false,
            moderation_status: modStatus,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      commitRateLimit(limitStatus.records);

      if (data?.id) {
        seenIdsRef.current.add(data.id);
        optimisticMapRef.current.delete(token);
        setMessages((current) =>
          current.map((msg) =>
            msg.runtimeId === runtimeOptimistic.runtimeId ? { ...msg, ...data, isOptimistic: false } : msg
          )
        );
      }
    } catch (err) {
      console.error("Message injection failed Postgres/RLS evaluation:", err);
      optimisticMapRef.current.delete(token);
      setMessages((current) => current.filter((msg) => msg.runtimeId !== runtimeOptimistic.runtimeId));
      setText(messageText); 
      triggerToast("The fire rejected your message (max. 140 characters).");
    }
  };

  const handleWarmth = useCallback(async (id) => {
    if (!id || String(id).startsWith("optimistic-") || warmthBusyIdsRef.current.has(id)) return;

    const rollbacks = new Map();
    warmthBusyIdsRef.current.add(id);

    setMessages((current) =>
      current.map((msg) => {
        if (msg.id !== id) return msg;
        rollbacks.set(msg.runtimeId, msg.warmth || 0);
        return { ...msg, warmth: (msg.warmth || 0) + 1 };
      })
    );

    try {
      const { data, error } = await supabase.rpc("increment_message_warmth", {
        message_id_input: id,
      });

      if (error) throw error;
      const responseNode = Array.isArray(data) ? data[0] : data;
      if (responseNode?.warmth !== undefined) {
        setMessages((current) =>
          current.map((msg) => msg.id === id ? { ...msg, warmth: responseNode.warmth } : msg)
        );
      }
    } catch (err) {
      console.error("Warmth transaction failed execution:", err);
      setMessages((current) =>
        current.map((msg) =>
          msg.id === id ? { ...msg, warmth: rollbacks.get(msg.runtimeId) ?? Math.max((msg.warmth || 1) - 1, 0) } : msg
        )
      );
      triggerToast("Warmth could not be sent.");
    } finally {
      warmthBusyIdsRef.current.delete(id);
    }
  }, [triggerToast]);

  const handleExport = async () => {
    if (!isAdmin || !adminToken || !room.id) {
      triggerToast("Export failed. Invalid admin token.");
      return;
    }

    try {
      const { data, error } = await supabase.rpc("export_room_messages", {
        room_id_input: room.id,
        admin_token_input: adminToken,
      });

      if (error || !data) {
        triggerToast("Export failed. Invalid admin token.");
        return;
      }

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>Export - ${safeHtml(room.name)}</title>
          <style>
            body { font-family: monospace; padding: 40px; background: #fafafa; color: #111; }
            h1 { font-weight: normal; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
            .msg { background: white; border: 1px solid #eee; padding: 15px; margin-bottom: 10px; border-radius: 8px; }
            .meta { color: #666; font-size: 12px; margin-bottom: 5px; }
            @media print { button { display: none; } }
          </style>
        </head>
        <body>
          <button onclick="window.print()" style="padding:10px 20px; margin-bottom:20px; cursor:pointer;">Print / Save as PDF</button>
          <h1>Campfire Export: ${safeHtml(room.name)}</h1>
          <p>Prompt: ${safeHtml(room.prompt)}</p>
          <div style="margin-top:30px;">
            ${data.map(m => `
              <div class="msg">
                <div class="meta">[${safeHtml(m.category)}] From: ${safeHtml(m.name)} - ${m.warmth || 0} warmth (Status: ${safeHtml(m.moderation_status || "–")})</div>
                <div>${safeHtml(m.text)}</div>
              </div>
            `).join("")}
          </div>
        </body>
        </html>
      `;

      const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `campfire-export-${safeHtml(room.name).replace(/\s+/g, "-")}.html`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export compiling failed:", err);
      triggerToast("Error preparing the export document.");
    }
  };

  return (
    <div className="relative z-10 min-h-screen w-full overflow-hidden">

      {/* Top bar — buttons */}
      <div className="absolute left-4 top-4 z-40 flex flex-wrap gap-2">
        <button onClick={onLeave} className="flex items-center gap-2 rounded-xl border border-orange-500/10 bg-neutral-900/80 px-4 py-2 text-xs uppercase tracking-wider backdrop-blur-md transition-colors hover:bg-neutral-800">
          <ArrowLeft className="h-3 w-3" /> Leave
        </button>
        {!isPublic && (
          <button onClick={() => setShowQrModal(true)} className="flex items-center gap-2 rounded-xl border border-orange-500/10 bg-neutral-900/80 px-4 py-2 text-xs uppercase tracking-wider backdrop-blur-md transition-colors hover:bg-neutral-800">
            <QrCode className="h-3 w-3" /> Invite
          </button>
        )}
        {isAdmin && (
          <button onClick={handleExport} className="flex items-center gap-2 rounded-xl border border-orange-500/30 bg-orange-950/40 px-4 py-2 text-xs uppercase tracking-wider text-orange-300 backdrop-blur-md transition-colors hover:bg-orange-900/40">
            <Download className="h-3 w-3" /> Export Results
          </button>
        )}
      </div>

      {/* Room title — subtle, top center */}
      <div className="pointer-events-none absolute inset-x-0 top-5 z-10 select-none text-center">
        <h1 className="text-base font-light tracking-wide text-orange-100/60 md:text-lg">{room.name}</h1>
        <p className="mt-1 font-serif text-[11px] italic text-orange-200/25 md:text-xs">„{room.prompt}"</p>
      </div>

      {/* Campfire — visual focal point, occupies most of the screen */}
      <div className="pointer-events-none absolute inset-x-0 top-0 bottom-[22%] flex items-center justify-center">
        <Campfire mood={moodFromCategory(activeMood)} />
      </div>

      {/* Floating messages — rise through the open space */}
      <div className="pointer-events-none absolute inset-x-6 bottom-[22%] top-16 overflow-visible">
        <AnimatePresence>
          {messages.map((message) => (
            <FloatingMessage
              key={message.runtimeId}
              message={message}
              onWarmth={() => handleWarmth(message.id)}
              warmthBusy={warmthBusyIdsRef.current.has(message.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Input panel — compact, pinned to bottom 22% of screen */}
      <div className="absolute inset-x-0 bottom-0 z-40 h-[22%] flex flex-col justify-end">
        {/* Thin fade — only enough to anchor the form, not kill the flame */}
        <div className="absolute inset-x-0 top-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        <div className="relative mx-auto w-full max-w-xl px-4 pb-1">
          <form onSubmit={handleSubmit} className="space-y-2 rounded-[1.6rem] border border-orange-500/10 bg-neutral-900/50 px-4 py-3 shadow-2xl backdrop-blur-xl">
            <div className="flex flex-wrap gap-1.5">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium tracking-wide transition-all ${
                    category === item
                      ? "border-orange-500 bg-orange-600/20 text-orange-300 shadow-md shadow-orange-950"
                      : "border-orange-500/5 bg-black/20 text-orange-100/50 hover:border-orange-500/20"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT_LENGTH))}
                placeholder={room.prompt || "Share your thoughts anonymously..."}
                className="flex-grow rounded-xl border border-orange-500/5 bg-black/40 px-3 py-2.5 text-sm text-orange-100 placeholder-neutral-500 transition-colors focus:border-orange-500/30 focus:outline-none"
              />
              <button type="submit" className="rounded-xl bg-orange-600 p-2.5 text-white shadow-lg shadow-orange-950 transition-colors hover:bg-orange-500 active:scale-95">
                <Flame className="h-4 w-4" />
              </button>
            </div>
          </form>
          <Footer onAbout={onAbout} />
        </div>
      </div>

      {showQrModal && (
        <InviteModal
          shareUrl={shareUrl}
          adminUrl={adminUrl}
          triggerToast={triggerToast}
          onClose={() => setShowQrModal(false)}
        />
      )}
    </div>
  );
}

// ✦ SCHÖNE CAMPFIRE-KOMPONENTE (aus altem Code)
function Campfire({ mood = "neutral", small = false }) {
  const sparks = mood === "sparks" ? 34 : 18;
  const smoke = mood === "smoke" ? 14 : 7;

  return (
    <div className={`pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 ${small ? "h-72 w-72" : "h-[34rem] w-[34rem]"}`}>
      <motion.div
        animate={{ scale: [0.96, 1.1, 0.96], opacity: [0.32, 0.62, 0.32] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 rounded-full bg-orange-500/20 blur-[90px]"
      />
      <div
        className="absolute bottom-[24%] left-1/2 -translate-x-1/2 rounded-full bg-yellow-100/75 blur-[15px]"
        style={{ width: small ? "55px" : "95px", height: small ? "45px" : "75px" }}
      />
      <div className="absolute left-1/2 top-1/2 h-64 w-56 -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_0_45px_rgba(251,146,60,.65)]">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{
              scaleY: [0.85, 1.2, 0.9],
              scaleX: [1, 0.78, 1.06],
              rotate: [-4 + i * 4, 4 - i * 2, -4 + i * 4],
              opacity: [0.72, 1, 0.78],
            }}
            transition={{ duration: 0.9 + i * 0.22, repeat: Infinity, ease: "easeInOut" }}
            className={`absolute bottom-12 left-1/2 origin-bottom -translate-x-1/2 rounded-bl-full rounded-t-full ${
              i === 0
                ? "h-48 w-32 bg-orange-600"
                : i === 1
                ? "h-40 w-24 bg-amber-400 mix-blend-screen"
                : "h-28 w-16 bg-yellow-100 mix-blend-screen"
            }`}
          />
        ))}
        <div className="absolute bottom-8 left-1/2 h-5 w-56 -translate-x-1/2 rotate-6 rounded-full bg-stone-950 shadow-md" />
        <div className="absolute bottom-8 left-1/2 h-5 w-56 -translate-x-1/2 -rotate-6 rounded-full bg-stone-900 shadow-md" />
      </div>
      {Array.from({ length: sparks }).map((_, i) => (
        <motion.span
          key={i}
          animate={{
            y: [-20, -230 - (i % 5) * 22],
            x: [0, (i % 2 ? 1 : -1) * (18 + i * 2)],
            opacity: [0, 1, 0],
          }}
          transition={{ duration: 2.4 + (i % 4), delay: i * 0.09, repeat: Infinity, ease: "easeOut" }}
          className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-orange-200 shadow-[0_0_14px_rgba(251,191,36,.95)]"
        />
      ))}
      {Array.from({ length: smoke }).map((_, i) => (
        <motion.span
          key={`smoke-${i}`}
          animate={{
            y: [-10, -280],
            x: [0, i % 2 ? 60 : -60],
            opacity: [0, mood === "smoke" ? 0.28 : 0.13, 0],
          }}
          transition={{ duration: 8 + i * 0.4, delay: i * 0.5, repeat: Infinity, ease: "easeOut" }}
          className="absolute left-1/2 top-[44%] h-24 w-24 rounded-full bg-stone-300/10 blur-2xl"
        />
      ))}
    </div>
  );
}

function InviteModal({ shareUrl, adminUrl, triggerToast, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-sm space-y-6 rounded-[2.5rem] border border-orange-500/10 bg-neutral-900 p-6 text-center shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-light">Share This Fire</h3>
          <button onClick={onClose} className="rounded-full p-2 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="inline-block rounded-3xl bg-white p-4 shadow-inner">
          <QRCodeSVG value={shareUrl} size={180} level="M" includeMargin={false} />
        </div>

        <LinkCopyBox label="Participant link" value={shareUrl} triggerToast={triggerToast} />
        {adminUrl && <LinkCopyBox label="Admin link (keep private)" value={adminUrl} triggerToast={triggerToast} />}
      </div>
    </div>
  );
}

function LinkCopyBox({ label, value, triggerToast }) {
  const [copied, setCopied] = useState(false);
  const localTimerRef = useRef(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (localTimerRef.current) window.clearTimeout(localTimerRef.current);
      localTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      triggerToast("Link could not be copied.");
    }
  };

  useEffect(() => {
    return () => {
      if (localTimerRef.current) window.clearTimeout(localTimerRef.current);
    };
  }, []);

  return (
    <div className="space-y-2">
      <p className="text-left text-xs text-neutral-400 pl-1">{label}</p>
      <div className="flex gap-2 rounded-xl border border-orange-500/5 bg-black/30 p-2">
        <input type="text" readOnly value={value} className="flex-grow select-all bg-transparent px-2 text-xs text-orange-200/60 focus:outline-none" />
        <button type="button" onClick={handleCopy} className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-800 p-2 text-orange-300 transition-all hover:bg-neutral-700">
          {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
}


function AboutPage({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-950/95 backdrop-blur-xl">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <button
          onClick={onClose}
          className="mb-10 flex items-center gap-2 text-xs uppercase tracking-widest text-orange-300/50 transition-colors hover:text-orange-300"
        >
          <ArrowLeft className="h-3 w-3" /> Back
        </button>

        <div className="space-y-10 text-orange-100/80">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <Flame className="h-6 w-6 text-orange-500" />
              <h1 className="text-2xl font-light tracking-tight text-orange-50">Digital Campfire</h1>
            </div>
            <p className="mt-4 leading-relaxed">
              Digital Campfire is a space for thoughts, questions, memories, hopes and reflections.
            </p>
            <p className="mt-3 leading-relaxed">
              Like a campfire, thoughts can be shared anonymously and watched as they rise through the flames.
            </p>
            <p className="mt-3 leading-relaxed">
              Digital Campfire can be used in workshops, classrooms, teams and public spaces.
            </p>
          </div>

          <div>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-orange-400">Rules</h2>
            <p className="leading-relaxed">Please treat others with respect.</p>
            <p className="mt-2 leading-relaxed">The following content is not allowed:</p>
            <ul className="mt-3 space-y-1.5 text-sm text-orange-100/60">
              {[
                "Harassment or insults",
                "Hate speech",
                "Discrimination",
                "Threats or violence",
                "Spam or advertising",
                "Illegal content",
                "Personal information about other people",
              ].map((rule) => (
                <li key={rule} className="flex items-start gap-2">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-orange-500/50" />
                  {rule}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-orange-100/50">Messages may be filtered or hidden automatically.</p>
          </div>

          <div>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-orange-400">Privacy</h2>
            <p className="leading-relaxed">Digital Campfire is designed to work anonymously.</p>
            <p className="mt-3 leading-relaxed">The platform may store:</p>
            <ul className="mt-3 space-y-1.5 text-sm text-orange-100/60">
              {[
                "Messages submitted to a fire",
                "Message categories",
                "Timestamps",
                "Anonymous session identifiers",
                "Technical usage data required to operate the service",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-orange-500/50" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-2 text-sm text-orange-100/50">
              <p>No user account is required.</p>
              <p>No names, email addresses or personal profiles are required.</p>
              <p>Private fires may be automatically deleted after their expiration period.</p>
            </div>
          </div>

          <div>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-orange-400">Liability</h2>
            <p className="leading-relaxed">Users are responsible for the content they submit.</p>
            <p className="mt-3 leading-relaxed text-orange-100/50 text-sm">
              Digital Campfire does not guarantee the accuracy, completeness or availability of submitted content.
            </p>
          </div>

          <div>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-orange-400">Contact</h2>
            <a
              href="mailto:contact@digitalcampfire.app"
              className="text-orange-400 underline underline-offset-4 transition-colors hover:text-orange-300"
            >
              contact@digitalcampfire.app
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Footer({ onAbout }) {
  return (
    <footer className="relative z-30 w-full border-t border-orange-500/5 bg-black/20 px-6 py-5 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 text-center sm:flex-row sm:justify-between">
        <p className="text-xs text-orange-100/20">Digital Campfire © 2026</p>
        <div className="flex items-center gap-5 text-xs text-orange-100/30">
          <button onClick={onAbout} className="transition-colors hover:text-orange-300">About</button>
          <button onClick={onAbout} className="transition-colors hover:text-orange-300">Privacy</button>
          <button onClick={onAbout} className="transition-colors hover:text-orange-300">Terms</button>
          <a href="mailto:contact@digitalcampfire.app" className="transition-colors hover:text-orange-300">Contact</a>
        </div>
      </div>
    </footer>
  );
}

const FloatingMessage = memo(function FloatingMessage({ message, onWarmth, warmthBusy }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 220, x: message.xOffset || 0, scale: 0.9 }}
      animate={{
        opacity: [0, 1, 0.9, 0],
        y: -650,
        x: [
          message.xOffset || 0,
          (message.xOffset || 0) + (message.sway || 16),
          (message.xOffset || 0) - (message.drift || 14),
          (message.xOffset || 0) + ((message.sway || 16) / 2),
        ],
        scale: [0.9, 1, 0.95],
      }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 26, ease: "linear" }}
      className={`pointer-events-auto absolute bottom-4 z-20 w-full max-w-[260px] rounded-[1.8rem] border bg-black/60 p-4 text-orange-50/90 shadow-[0_0_40px_rgba(0,0,0,0.6)] backdrop-blur-xl transition-shadow hover:shadow-[0_0_30px_rgba(251,146,60,.12)] ${
        message.moderation_status === "shadow_blocked"
          ? "border-red-500/20"
          : "border-orange-100/10"
      }`}
      style={{ left: `${message.x}%` }}
    >
      <div className="flex items-center justify-between gap-4">
        <span className="font-mono text-[10px] uppercase tracking-wider text-orange-300/40">{message.name}</span>
        <span className="rounded-md border border-orange-500/10 bg-orange-950/40 px-2 py-0.5 text-[9px] text-orange-200/50">
          {message.category} {message.moderation_status === "shadow_blocked" && "👁️"}
        </span>
      </div>
      <p className="break-words text-sm font-light leading-relaxed text-orange-100/90">{message.text}</p>
      <button
        type="button"
        disabled={message.isOptimistic || warmthBusy}
        onClick={(e) => {
          e.stopPropagation();
          onWarmth();
        }}
        className="group mt-1 flex items-center gap-1.5 self-start text-[10px] text-orange-300/40 transition-colors hover:text-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Heart className="h-3 w-3 text-orange-500/40 transition-transform group-hover:scale-110 group-hover:text-orange-500" />
        <span>{message.warmth || 0}</span>
      </button>
    </motion.div>
  );
});