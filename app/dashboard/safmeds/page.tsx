"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Section from "@/components/ui/Section";
import PageHeader from "@/components/layout/PageHeader";
import Button from "@/components/ui/Button";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";

type DBCard = {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  category: string | null;
};

type Deck = {
  id: string;
  name: string;
  description: string | null;
};

type Attempt = {
  id: string;
  card_id: string;
  correct: boolean;
  duration_seconds: number | null;
  created_at: string;
};

type LeaderboardEntry = {
  user_id: string;
  name: string;
  accuracy: number;
  total: number;
};

const DEFAULT_CARDS = [
  { front: "ABA", back: "Applied Behavior Analysis — the science of behavior change through antecedents and consequences", category: "Definitions" },
  { front: "Reinforcement", back: "A consequence that increases the future frequency of a behavior", category: "Definitions" },
  { front: "Punishment", back: "A consequence that decreases the future frequency of a behavior", category: "Definitions" },
  { front: "Extinction", back: "Withholding reinforcement for a previously reinforced behavior, reducing its frequency", category: "Definitions" },
  { front: "Antecedent", back: "Any stimulus that precedes and influences a behavior", category: "ABC" },
  { front: "Behavior", back: "Any observable and measurable action of an organism", category: "ABC" },
  { front: "Consequence", back: "Any stimulus that follows a behavior and affects its future frequency", category: "ABC" },
  { front: "FBA", back: "Functional Behavior Assessment — process to identify the function of a behavior", category: "Assessments" },
  { front: "Mand", back: "A verbal operant where the speaker requests something", category: "Verbal Operants" },
  { front: "Tact", back: "A verbal operant where the speaker labels something in the environment", category: "Verbal Operants" },
  { front: "Intraverbal", back: "A verbal operant controlled by prior verbal behavior", category: "Verbal Operants" },
  { front: "LRFFC", back: "Listener Responding by Function, Feature, and Class", category: "Verbal Operants" },
  { front: "DTT", back: "Discrete Trial Training — structured teaching with clear beginning, middle, and end", category: "Teaching Methods" },
  { front: "NET", back: "Natural Environment Training — teaching in everyday contexts", category: "Teaching Methods" },
  { front: "Prompt", back: "Supplemental stimulus that helps produce a correct response", category: "Prompting" },
  { front: "Prompt Fading", back: "Systematically reducing assistance to promote independence", category: "Prompting" },
  { front: "Chaining", back: "Teaching a sequence of behaviors as links in a chain", category: "Teaching Methods" },
  { front: "Shaping", back: "Reinforcing successive approximations toward a target behavior", category: "Teaching Methods" },
  { front: "Generalization", back: "A behavior occurring in situations beyond original training", category: "Definitions" },
  { front: "VB-MAPP", back: "Verbal Behavior Milestones Assessment and Placement Program", category: "Assessments" },
];

export default function SAFMEDSPage() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [cards, setCards] = useState<DBCard[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Study state
  const [shuffled, setShuffled] = useState<DBCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [correct, setCorrect] = useState<string[]>([]);
  const [incorrect, setIncorrect] = useState<string[]>([]);
  const [mode, setMode] = useState<"select" | "study" | "timed" | "results" | "history" | "leaderboard">("select");
  const [timeLeft, setTimeLeft] = useState(60);
  const [timerActive, setTimerActive] = useState(false);
  const [sessionStart, setSessionStart] = useState<number>(0);

  // New deck form
  const [showNewDeck, setShowNewDeck] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [newDeckDesc, setNewDeckDesc] = useState("");
  const [savingDeck, setSavingDeck] = useState(false);

  // New card form
  const [showNewCard, setShowNewCard] = useState(false);
  const [newCardFront, setNewCardFront] = useState("");
  const [newCardBack, setNewCardBack] = useState("");
  const [newCardCategory, setNewCardCategory] = useState("");

  useEffect(() => { init(); }, []);

  useEffect(() => {
    if (!timerActive) return;
    if (timeLeft <= 0) { setTimerActive(false); setMode("results"); return; }
    const t = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(t);
  }, [timerActive, timeLeft]);

  async function init() {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;
    setUserId(user.id);

    const { data: deckData } = await supabase
      .from("safmeds_decks")
      .select("id, name, description")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });

    // Create default deck if none exist
    if (!deckData || deckData.length === 0) {
      const { data: newDeck } = await supabase
        .from("safmeds_decks")
        .insert({ name: "ABA Core Concepts", description: "Default ABA terminology deck", created_by: user.id })
        .select()
        .single();

      if (newDeck) {
        await supabase.from("safmeds_cards").insert(
          DEFAULT_CARDS.map((c) => ({ deck_id: newDeck.id, ...c }))
        );
        setDecks([newDeck]);
      }
    } else {
      setDecks(deckData);
    }

    setLoading(false);
  }

  async function loadDeck(deckId: string) {
    setSelectedDeckId(deckId);

    const [{ data: cardData }, { data: attemptData }] = await Promise.all([
      supabase.from("safmeds_cards").select("*").eq("deck_id", deckId),
      supabase.from("safmeds_attempts").select("*").eq("deck_id", deckId).eq("user_id", userId!).order("created_at", { ascending: false }).limit(200),
    ]);

    setCards(cardData ?? []);
    setAttempts(attemptData ?? []);

    const s = [...(cardData ?? [])].sort(() => Math.random() - 0.5);
    setShuffled(s);
    setCurrentIndex(0);
    setFlipped(false);
    setCorrect([]);
    setIncorrect([]);
    setMode("study");
  }

  async function handleAnswer(isCorrect: boolean) {
    const card = shuffled[currentIndex];
    if (!card || !userId || !selectedDeckId) return;

    const duration = Math.round((Date.now() - sessionStart) / 1000);

    await supabase.from("safmeds_attempts").insert({
      user_id: userId,
      deck_id: selectedDeckId,
      card_id: card.id,
      correct: isCorrect,
      duration_seconds: duration,
    });

    if (isCorrect) setCorrect((prev) => [...prev, card.id]);
    else setIncorrect((prev) => [...prev, card.id]);

    setSessionStart(Date.now());

    if (currentIndex < shuffled.length - 1) {
      setCurrentIndex((i) => i + 1);
      setFlipped(false);
    } else {
      setMode("results");
      setTimerActive(false);
    }
  }

  function startStudy(timed = false) {
    const s = [...cards].sort(() => Math.random() - 0.5);
    setShuffled(s);
    setCurrentIndex(0);
    setFlipped(false);
    setCorrect([]);
    setIncorrect([]);
    setSessionStart(Date.now());

    if (timed) {
      setTimeLeft(60);
      setTimerActive(true);
      setMode("timed");
    } else {
      setMode("study");
    }
  }

  async function loadLeaderboard() {
    if (!selectedDeckId) return;

    const { data } = await supabase
      .from("safmeds_attempts")
      .select("user_id, correct")
      .eq("deck_id", selectedDeckId);

    if (!data) return;

    const userStats = new Map<string, { correct: number; total: number }>();
    data.forEach((a: { user_id: string; correct: boolean }) => {
      const s = userStats.get(a.user_id) ?? { correct: 0, total: 0 };
      userStats.set(a.user_id, {
        correct: s.correct + (a.correct ? 1 : 0),
        total: s.total + 1,
      });
    });

    const entries: LeaderboardEntry[] = Array.from(userStats.entries()).map(([uid, s]) => ({
      user_id: uid,
      name: uid === userId ? "You" : `User ${uid.slice(0, 6)}`,
      accuracy: s.total ? Math.round((s.correct / s.total) * 100) : 0,
      total: s.total,
    })).sort((a, b) => b.accuracy - a.accuracy);

    setLeaderboard(entries);
    setMode("leaderboard");
  }

  async function createDeck() {
    if (!newDeckName.trim() || !userId) return;
    setSavingDeck(true);

    const { data: deck } = await supabase
      .from("safmeds_decks")
      .insert({ name: newDeckName, description: newDeckDesc, created_by: userId })
      .select()
      .single();

    if (deck) {
      setDecks((prev) => [deck, ...prev]);
      setNewDeckName("");
      setNewDeckDesc("");
      setShowNewDeck(false);
    }

    setSavingDeck(false);
  }

  async function addCard() {
    if (!newCardFront.trim() || !newCardBack.trim() || !selectedDeckId) return;

    const { data } = await supabase
      .from("safmeds_cards")
      .insert({ deck_id: selectedDeckId, front: newCardFront, back: newCardBack, category: newCardCategory || null })
      .select()
      .single();

    if (data) {
      setCards((prev) => [...prev, data]);
      setNewCardFront("");
      setNewCardBack("");
      setNewCardCategory("");
      setShowNewCard(false);
    }
  }

  // MASTERY CHART — accuracy over last 10 sessions
  const chartData = attempts
    .slice(0, 50)
    .reverse()
    .reduce((acc: { session: string; accuracy: number }[], attempt, i) => {
      const last = acc[acc.length - 1];
      if (!last || i % 5 === 0) {
        acc.push({ session: `S${Math.floor(i / 5) + 1}`, accuracy: attempt.correct ? 100 : 0 });
      } else {
        last.accuracy = Math.round((last.accuracy + (attempt.correct ? 100 : 0)) / 2);
      }
      return acc;
    }, []);

  const total = correct.length + incorrect.length;
  const accuracy = total ? Math.round((correct.length / total) * 100) : 0;
  const currentCard = shuffled[currentIndex];
  const allTimeCorrect = attempts.filter((a) => a.correct).length;
  const allTimeTotal = attempts.length;
  const allTimeAccuracy = allTimeTotal ? Math.round((allTimeCorrect / allTimeTotal) * 100) : 0;

  if (loading) return <div className="p-6 text-gray-400">Loading SAFMEDS...</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="SAFMEDS">
        <p className="text-gray-500 text-sm">Say All Fast Minute Every Day Shuffled</p>
      </PageHeader>

      {/* DECK SELECTION */}
      {mode === "select" && (
        <>
          <Section title="My Decks">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              {decks.map((deck) => (
                <div
                  key={deck.id}
                  onClick={() => loadDeck(deck.id)}
                  className="border border-gray-200 rounded-xl p-4 bg-white cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
                >
                  <p className="font-semibold text-gray-800">{deck.name}</p>
                  {deck.description && <p className="text-xs text-gray-400 mt-0.5">{deck.description}</p>}
                </div>
              ))}
            </div>
            <Button variant="outline" onClick={() => setShowNewDeck(!showNewDeck)}>
              + Create Deck
            </Button>
          </Section>

          {showNewDeck && (
            <Section title="Create New Deck">
              <div className="space-y-3 max-w-md">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Deck Name</label>
                  <input
                    type="text"
                    value={newDeckName}
                    onChange={(e) => setNewDeckName(e.target.value)}
                    placeholder="e.g. BCBA Exam Prep"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
                  <input
                    type="text"
                    value={newDeckDesc}
                    onChange={(e) => setNewDeckDesc(e.target.value)}
                    placeholder="Optional description..."
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={createDeck} loading={savingDeck}>Create</Button>
                  <Button variant="outline" onClick={() => setShowNewDeck(false)}>Cancel</Button>
                </div>
              </div>
            </Section>
          )}
        </>
      )}

      {/* STUDY MODE */}
      {(mode === "study" || mode === "timed") && selectedDeckId && (
        <>
          {/* DECK CONTROLS */}
          <div className="flex flex-wrap gap-2 items-center">
            <Button variant="outline" onClick={() => setMode("select")}>← Decks</Button>
            <Button variant="outline" onClick={() => startStudy(false)}>Shuffle</Button>
            <Button variant="outline" onClick={() => startStudy(true)}>⏱ Timed (60s)</Button>
            <Button variant="outline" onClick={() => setMode("history")}>History</Button>
            <Button variant="outline" onClick={loadLeaderboard}>🏆 Leaderboard</Button>
            <Button variant="outline" onClick={() => setShowNewCard(!showNewCard)}>+ Add Card</Button>
            <p className="text-sm text-gray-400 ml-auto">{cards.length} cards</p>
          </div>

          {/* ALL-TIME STATS */}
          {allTimeTotal > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="border rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-blue-600">{allTimeAccuracy}%</p>
                <p className="text-xs text-gray-500">All-time accuracy</p>
              </div>
              <div className="border rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-green-600">{allTimeCorrect}</p>
                <p className="text-xs text-gray-500">Correct</p>
              </div>
              <div className="border rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-gray-700">{allTimeTotal}</p>
                <p className="text-xs text-gray-500">Attempts</p>
              </div>
            </div>
          )}

          {/* ADD CARD */}
          {showNewCard && (
            <Section title="Add Card">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-lg">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Front (Term)</label>
                  <input
                    type="text"
                    value={newCardFront}
                    onChange={(e) => setNewCardFront(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Category</label>
                  <input
                    type="text"
                    value={newCardCategory}
                    onChange={(e) => setNewCardCategory(e.target.value)}
                    placeholder="e.g. Definitions"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Back (Definition)</label>
                  <textarea
                    value={newCardBack}
                    onChange={(e) => setNewCardBack(e.target.value)}
                    rows={2}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={addCard}>Add</Button>
                  <Button variant="outline" onClick={() => setShowNewCard(false)}>Cancel</Button>
                </div>
              </div>
            </Section>
          )}

          {/* FLASHCARD */}
          {currentCard && (
            <Section title={
              mode === "timed"
                ? `⏱ ${timeLeft}s · Card ${currentIndex + 1}/${shuffled.length}`
                : `Card ${currentIndex + 1} of ${shuffled.length}`
            }>
              <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${(currentIndex / shuffled.length) * 100}%` }}
                />
              </div>
              <div className="flex gap-3 mb-4">
                <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">✓ {correct.length}</span>
                <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">✗ {incorrect.length}</span>
                {currentCard.category && (
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">{currentCard.category}</span>
                )}
              </div>

              <div
                onClick={() => setFlipped(!flipped)}
                className="border-2 border-gray-200 rounded-2xl p-8 text-center cursor-pointer hover:border-blue-300 transition-all min-h-48 flex flex-col items-center justify-center bg-white"
              >
                {!flipped ? (
                  <div>
                    <p className="text-2xl font-bold text-gray-800">{currentCard.front}</p>
                    <p className="text-xs text-gray-400 mt-4">Click to reveal</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-blue-600 mb-2">{currentCard.front}</p>
                    <p className="text-lg text-gray-700">{currentCard.back}</p>
                  </div>
                )}
              </div>

              {flipped && (
                <div className="flex gap-3 mt-4 justify-center">
                  <Button variant="danger" onClick={() => handleAnswer(false)}>✗ Incorrect</Button>
                  <Button onClick={() => handleAnswer(true)}>✓ Correct</Button>
                </div>
              )}
              {!flipped && (
                <div className="flex gap-2 mt-4 justify-center">
                  <Button variant="outline" onClick={() => setFlipped(true)}>Flip</Button>
                  <Button variant="outline" onClick={() => startStudy(false)}>Restart</Button>
                </div>
              )}
            </Section>
          )}
        </>
      )}

      {/* RESULTS */}
      {mode === "results" && (
        <Section title="Session Results">
          <div className="text-center space-y-4 py-4">
            <p className="text-5xl font-bold text-blue-600">{accuracy}%</p>
            <p className="text-gray-500">Session Accuracy</p>
            <div className="flex justify-center gap-8">
              <div>
                <p className="text-2xl font-bold text-green-600">{correct.length}</p>
                <p className="text-xs text-gray-500">Correct</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-500">{incorrect.length}</p>
                <p className="text-xs text-gray-500">Incorrect</p>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              {accuracy >= 90 ? "🎉 Mastery level achieved!" :
               accuracy >= 70 ? "👍 Good job! Keep practicing." :
               "📚 Keep studying!"}
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => startStudy(false)}>Study Again</Button>
              <Button variant="outline" onClick={() => setMode("history")}>View History</Button>
              <Button variant="outline" onClick={loadLeaderboard}>🏆 Leaderboard</Button>
            </div>
          </div>

          {/* MASTERY CHART */}
          {chartData.length >= 2 && (
            <div className="mt-6">
              <p className="text-sm font-medium text-gray-700 mb-3">Accuracy Over Time</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="session" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v) => [`${v}%`, "Accuracy"]} />
                  <Line type="monotone" dataKey="accuracy" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>
      )}

      {/* HISTORY */}
      {mode === "history" && (
        <Section title="Attempt History">
          <div className="flex gap-2 mb-4">
            <Button variant="outline" onClick={() => startStudy(false)}>← Back to Study</Button>
          </div>
          <div className="space-y-2">
            {attempts.slice(0, 50).map((a) => (
              <div key={a.id} className="border border-gray-100 rounded-lg p-3 bg-white flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-400">{new Date(a.created_at).toLocaleString()}</p>
                  {a.duration_seconds && (
                    <p className="text-xs text-gray-400">{a.duration_seconds}s</p>
                  )}
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  a.correct ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}>
                  {a.correct ? "✓ Correct" : "✗ Incorrect"}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* LEADERBOARD */}
      {mode === "leaderboard" && (
        <Section title="🏆 Leaderboard">
          <div className="flex gap-2 mb-4">
            <Button variant="outline" onClick={() => startStudy(false)}>← Back to Study</Button>
          </div>
          {leaderboard.length === 0 ? (
            <p className="text-gray-400 text-sm">No attempts yet.</p>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, i) => (
                <div key={entry.user_id} className={`border rounded-lg p-3 flex justify-between items-center ${
                  entry.user_id === userId ? "border-blue-200 bg-blue-50" : "border-gray-100 bg-white"
                }`}>
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-bold ${
                      i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-orange-500" : "text-gray-300"
                    }`}>
                      #{i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{entry.name}</p>
                      <p className="text-xs text-gray-400">{entry.total} attempts</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-blue-600">{entry.accuracy}%</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}
    </div>
  );
}