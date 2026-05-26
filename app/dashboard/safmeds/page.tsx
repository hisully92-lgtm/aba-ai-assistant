"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";

type Card = { front: string; back: string };
type Deck = {
  id: string;
  deck_name: string;
  category: string;
  cards: Card[];
  created_at: string;
};
type SessionResult = {
  id: string;
  deck_id: string;
  correct: number;
  incorrect: number;
  duration_seconds: number;
  session_date: string;
  created_at: string;
};

const DEFAULT_DECKS = [
  {
    deck_name: "RBT Exam Prep — ABA Basics",
    category: "RBT",
    cards: [
      { front: "What is reinforcement?", back: "A consequence that increases the future frequency of a behavior" },
      { front: "What is punishment?", back: "A consequence that decreases the future frequency of a behavior" },
      { front: "What is extinction?", back: "Withholding reinforcement for a previously reinforced behavior" },
      { front: "What is an SD?", back: "Discriminative stimulus — a signal that reinforcement is available" },
      { front: "What is shaping?", back: "Reinforcing successive approximations toward a target behavior" },
      { front: "What is chaining?", back: "Teaching a sequence of behaviors that form a complex skill" },
      { front: "What is prompting?", back: "Supplementary stimuli used to occasion a correct response" },
      { front: "What is fading?", back: "Gradually reducing prompts to promote independence" },
      { front: "What is generalization?", back: "Behavior occurring across untrained settings, people, or stimuli" },
      { front: "What is a mand?", back: "A verbal operant controlled by motivating operations — a request" },
      { front: "What is a tact?", back: "A verbal operant controlled by a non-verbal stimulus — a label" },
      { front: "What is an intraverbal?", back: "A verbal operant controlled by another verbal stimulus" },
      { front: "What is an echoic?", back: "Repeating exactly what was said by another person" },
      { front: "What is a motivating operation?", back: "A variable that alters the value of a reinforcer and evokes behavior" },
      { front: "What is ABA?", back: "Applied Behavior Analysis — science of behavior and its application" },
    ],
  },
  {
    deck_name: "BCBA Exam Prep — Measurement",
    category: "BCBA",
    cards: [
      { front: "What is frequency?", back: "Count of how many times a behavior occurs" },
      { front: "What is rate?", back: "Frequency divided by observation time" },
      { front: "What is duration?", back: "Total time a behavior occurs" },
      { front: "What is latency?", back: "Time between SD and response" },
      { front: "What is IRT?", back: "Interresponse time — time between two consecutive responses" },
      { front: "What is whole interval recording?", back: "Behavior must occur entire interval to be scored" },
      { front: "What is partial interval recording?", back: "Behavior scored if it occurs at any point in interval" },
      { front: "What is momentary time sampling?", back: "Behavior scored only if occurring at end of interval" },
      { front: "What is permanent product?", back: "Recording outcomes of behavior rather than behavior itself" },
      { front: "What is IOA?", back: "Interobserver agreement — reliability measure between two observers" },
    ],
  },
  {
    deck_name: "Ethics & Professional Conduct",
    category: "BCBA",
    cards: [
      { front: "What is the BACB?", back: "Behavior Analyst Certification Board — certifying body for BCBAs and RBTs" },
      { front: "What are the core principles of the BACB Ethics Code?", back: "Benefit others, treat with compassion, act with integrity, ensure competence" },
      { front: "What is dual relationship?", back: "Having a personal or professional relationship with a client outside therapy" },
      { front: "What is informed consent?", back: "Client/guardian agreement to treatment after full disclosure of risks and benefits" },
      { front: "What is confidentiality?", back: "Protecting client information from unauthorized disclosure" },
      { front: "What is scope of competence?", back: "Practicing only within areas of expertise and training" },
      { front: "What is supervision in ABA?", back: "Oversight of RBTs and others by qualified BCBAs per BACB standards" },
    ],
  },
];

export default function SAFMEDSPage() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [sessions, setSessions] = useState<SessionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"decks" | "study" | "results" | "create">("decks");
  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);
  const [saving, setSaving] = useState(false);

  // Study session state
  const [shuffledCards, setShuffledCards] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [incorrect, setIncorrect] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Create deck state
  const [newDeckName, setNewDeckName] = useState("");
  const [newCategory, setNewCategory] = useState("RBT");
  const [newCards, setNewCards] = useState<Card[]>([{ front: "", back: "" }]);

  useEffect(() => { init(); }, []);

  useEffect(() => {
    if (sessionActive && timeLeft > 0) {
      timerRef.current = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    } else if (sessionActive && timeLeft === 0) {
      endSession();
    }
    return () => clearTimeout(timerRef.current!);
  }, [sessionActive, timeLeft]);

  // Enter key support
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (activeView === "study" && sessionActive) {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); setShowBack((s) => !s); }
        if (e.key === "ArrowRight" || e.key === "l") markCard(true);
        if (e.key === "ArrowLeft" || e.key === "a") markCard(false);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeView, sessionActive, currentIndex]);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const [{ data: deckData }, { data: sessionData }] = await Promise.all([
      supabase.from("safmeds_decks").select("*").eq("created_by", user.id).order("created_at", { ascending: false }),
      supabase.from("safmeds_sessions").select("*").eq("created_by", user.id).order("created_at", { ascending: false }),
    ]);

    if (!deckData || deckData.length === 0) {
      await seedDefaultDecks(user.id);
    } else {
      setDecks(deckData.map((d: any) => ({ ...d, cards: Array.isArray(d.cards) ? d.cards : JSON.parse(d.cards || "[]") })));
    }
    setSessions(sessionData ?? []);
    setLoading(false);
  }

  async function seedDefaultDecks(userId: string) {
    const { data } = await supabase.from("safmeds_decks").insert(
      DEFAULT_DECKS.map((d) => ({ ...d, cards: JSON.stringify(d.cards), created_by: userId }))
    ).select();
    setDecks((data ?? []).map((d: any) => ({ ...d, cards: Array.isArray(d.cards) ? d.cards : JSON.parse(d.cards || "[]") })));
  }

  function startStudy(deck: Deck) {
    const shuffled = [...deck.cards].sort(() => Math.random() - 0.5);
    setShuffledCards(shuffled);
    setActiveDeck(deck);
    setCurrentIndex(0);
    setShowBack(false);
    setCorrect(0);
    setIncorrect(0);
    setTimeLeft(60);
    setSessionActive(true);
    setSessionDone(false);
    setActiveView("study");
  }

  function markCard(isCorrect: boolean) {
    if (!sessionActive || sessionDone) return;
    if (isCorrect) setCorrect((c) => c + 1);
    else setIncorrect((i) => i + 1);
    if (currentIndex + 1 >= shuffledCards.length) {
      setShuffledCards((prev) => [...prev].sort(() => Math.random() - 0.5));
      setCurrentIndex(0);
    } else {
      setCurrentIndex((i) => i + 1);
    }
    setShowBack(false);
  }

  async function endSession() {
    clearTimeout(timerRef.current!);
    setSessionActive(false);
    setSessionDone(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user || !activeDeck) return;

    const { data } = await supabase.from("safmeds_sessions").insert([{
      deck_id: activeDeck.id,
      correct,
      incorrect,
      duration_seconds: 60,
      session_date: new Date().toISOString().split("T")[0],
      created_by: user.id,
    }]).select().single();

    if (data) setSessions((prev) => [data, ...prev]);
    setActiveView("results");
  }

  async function handleCreateDeck() {
    if (!newDeckName || newCards.filter((c) => c.front).length === 0) return;
    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const validCards = newCards.filter((c) => c.front.trim());
    const { data } = await supabase.from("safmeds_decks").insert([{
      deck_name: newDeckName,
      category: newCategory,
      cards: JSON.stringify(validCards),
      created_by: user.id,
    }]).select().single();

    if (data) setDecks((prev) => [{ ...data, cards: validCards }, ...prev]);
    setNewDeckName(""); setNewCategory("RBT"); setNewCards([{ front: "", back: "" }]);
    setActiveView("decks");
    setSaving(false);
  }

  async function handleDeleteDeck(id: string) {
    await supabase.from("safmeds_decks").delete().eq("id", id);
    setDecks((prev) => prev.filter((d) => d.id !== id));
  }

  function addCard() { setNewCards((prev) => [...prev, { front: "", back: "" }]); }
  function updateCard(i: number, field: "front" | "back", value: string) {
    setNewCards((prev) => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  }
  function removeCard(i: number) { setNewCards((prev) => prev.filter((_, idx) => idx !== i)); }

  const deckSessionMap = sessions.reduce((acc, s) => {
    acc[s.deck_id] = acc[s.deck_id] ?? [];
    acc[s.deck_id].push(s);
    return acc;
  }, {} as Record<string, SessionResult[]>);

  const currentCard = shuffledCards[currentIndex];

  return (
    <div className="space-y-6">
      <PageHeader title="SAFMEDS">
        <div className="flex gap-2">
          {activeView !== "decks" && (
            <Button variant="outline" onClick={() => { setActiveView("decks"); setSessionActive(false); }}>← Back to Decks</Button>
          )}
          {activeView === "decks" && (
            <Button onClick={() => setActiveView("create")}>+ Create Deck</Button>
          )}
        </div>
      </PageHeader>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
        ⚡ Say All Fast a Minute Every Day Shuffled — build fluency and rapid recall for RBT & BCBA exams.
        <span className="ml-2 text-blue-500">Keyboard: Space/Enter = flip · → = correct · ← = incorrect</span>
      </div>

      {/* DECKS VIEW */}
      {activeView === "decks" && (
        <>
          {loading && <p className="text-gray-400 text-sm">Loading decks...</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {decks.map((deck) => {
              const deckSessions = deckSessionMap[deck.id] ?? [];
              const bestScore = deckSessions.length ? Math.max(...deckSessions.map((s) => s.correct)) : 0;
              const lastSession = deckSessions[0];
              return (
                <div key={deck.id} className="border border-gray-100 rounded-xl p-4 bg-white">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold text-gray-800">{deck.deck_name}</p>
                      <div className="flex gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${deck.category === "BCBA" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                          {deck.category}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {deck.cards.length} cards
                        </span>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteDeck(deck.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                  </div>
                  {deckSessions.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                      <div className="border rounded-lg p-2">
                        <p className="text-sm font-bold text-blue-600">{deckSessions.length}</p>
                        <p className="text-xs text-gray-400">Sessions</p>
                      </div>
                      <div className="border rounded-lg p-2">
                        <p className="text-sm font-bold text-green-600">{bestScore}</p>
                        <p className="text-xs text-gray-400">Best Score</p>
                      </div>
                      <div className="border rounded-lg p-2">
                        <p className="text-sm font-bold text-purple-600">
                          {lastSession ? `${lastSession.correct}/${lastSession.correct + lastSession.incorrect}` : "—"}
                        </p>
                        <p className="text-xs text-gray-400">Last</p>
                      </div>
                    </div>
                  )}
                  <Button onClick={() => startStudy(deck)} className="w-full">
                    ▶ Start SAFMEDS (60s)
                  </Button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* STUDY VIEW */}
      {activeView === "study" && currentCard && (
        <Section title={`${activeDeck?.deck_name} — ${timeLeft}s remaining`}>
          <div className="text-center space-y-6 py-4">
            {/* TIMER BAR */}
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div className={`h-3 rounded-full transition-all ${timeLeft > 30 ? "bg-green-500" : timeLeft > 10 ? "bg-yellow-500" : "bg-red-500"}`}
                style={{ width: `${(timeLeft / 60) * 100}%` }} />
            </div>

            {/* STATS */}
            <div className="flex justify-center gap-8">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">{correct}</p>
                <p className="text-xs text-gray-400">Correct</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-400">{currentIndex + 1}/{shuffledCards.length}</p>
                <p className="text-xs text-gray-400">Card</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-red-500">{incorrect}</p>
                <p className="text-xs text-gray-400">Incorrect</p>
              </div>
            </div>

            {/* CARD */}
            <div
              onClick={() => setShowBack((s) => !s)}
              className="cursor-pointer border-2 border-blue-200 rounded-2xl p-8 bg-white shadow-lg min-h-40 flex items-center justify-center transition-all hover:shadow-xl active:scale-98"
            >
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">
                  {showBack ? "Answer" : "Question"} — tap or press Space to flip
                </p>
                <p className="text-xl font-semibold text-gray-800">
                  {showBack ? currentCard.back : currentCard.front}
                </p>
              </div>
            </div>

            {/* BUTTONS */}
            <div className="flex gap-4 justify-center">
              <button onClick={() => markCard(false)}
                className="w-36 h-16 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-95">
                ✗ Incorrect (←)
              </button>
              <button onClick={() => markCard(true)}
                className="w-36 h-16 bg-green-500 hover:bg-green-600 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-95">
                ✓ Correct (→)
              </button>
            </div>

            <Button variant="danger" onClick={endSession}>End Session Early</Button>
          </div>
        </Section>
      )}

      {/* RESULTS VIEW */}
      {activeView === "results" && (
        <Section title="Session Complete!">
          <div className="text-center space-y-6 py-4">
            <div className="text-6xl">🎉</div>
            <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
              <div className="border rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-green-600">{correct}</p>
                <p className="text-xs text-gray-400 mt-1">Correct</p>
              </div>
              <div className="border rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-red-500">{incorrect}</p>
                <p className="text-xs text-gray-400 mt-1">Incorrect</p>
              </div>
              <div className="border rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-blue-600">
                  {correct + incorrect > 0 ? Math.round((correct / (correct + incorrect)) * 100) : 0}%
                </p>
                <p className="text-xs text-gray-400 mt-1">Accuracy</p>
              </div>
            </div>
            <div className="flex gap-3 justify-center">
              {activeDeck && <Button onClick={() => startStudy(activeDeck)}>🔄 Study Again</Button>}
              <Button variant="outline" onClick={() => setActiveView("decks")}>← Back to Decks</Button>
            </div>
          </div>
        </Section>
      )}

      {/* CREATE DECK VIEW */}
      {activeView === "create" && (
        <Section title="Create New Deck">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Deck Name *</label>
              <input type="text" value={newDeckName} onChange={(e) => setNewDeckName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && document.getElementById("category-select")?.focus()}
                placeholder="e.g. My RBT Flashcards"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Category</label>
              <select id="category-select" value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                {["RBT", "BCBA", "BCaBA", "Ethics", "Measurement", "Other"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3 mb-4">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-gray-700">Cards ({newCards.filter((c) => c.front).length} valid)</label>
              <Button variant="outline" onClick={addCard}>+ Add Card</Button>
            </div>
            {newCards.map((card, i) => (
              <div key={i} className="grid grid-cols-2 gap-3 border border-gray-100 rounded-lg p-3 bg-gray-50">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Front (Question)</label>
                  <textarea value={card.front} onChange={(e) => updateCard(i, "front", e.target.value)}
                    placeholder="Question or term..." rows={2}
                    className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Back (Answer)</label>
                  <textarea value={card.back} onChange={(e) => updateCard(i, "back", e.target.value)}
                    placeholder="Answer or definition..." rows={2}
                    className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300" />
                </div>
                {newCards.length > 1 && (
                  <button onClick={() => removeCard(i)} className="text-xs text-red-400 hover:text-red-600 col-span-2 text-right">Remove card</button>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button onClick={handleCreateDeck} loading={saving} disabled={!newDeckName || newCards.filter((c) => c.front).length === 0}>
              Save Deck
            </Button>
            <Button variant="outline" onClick={() => setActiveView("decks")}>Cancel</Button>
          </div>
        </Section>
      )}
    </div>
  );
}