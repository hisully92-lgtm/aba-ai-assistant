"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Mode =
  | "notes"
  | "interventions"
  | "programs"
  | "clients"
  | "history"
  | "profile";

export default function Dashboard() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("notes");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const [staffMember, setStaffMember] = useState("");
  const [historyClientFilter, setHistoryClientFilter] = useState("");
  const [historyDateFilter, setHistoryDateFilter] = useState("");
  const [historyTypeFilter, setHistoryTypeFilter] = useState("");
  const [historyStaffFilter, setHistoryStaffFilter] = useState("");

  const [clients, setClients] = useState<any[]>([]);
  const [clientName, setClientName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [caregiverName, setCaregiverName] = useState("");
  const [goals, setGoals] = useState("");
  const [behaviors, setBehaviors] = useState("");
  const [skillPrograms, setSkillPrograms] = useState("");

  const [sessionClient, setSessionClient] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionLocation, setSessionLocation] = useState("");
  const [sessionDuration, setSessionDuration] = useState("");
  const [peoplePresent, setPeoplePresent] = useState("");
  const [programsTargeted, setProgramsTargeted] = useState("");
  const [behaviorsObserved, setBehaviorsObserved] = useState("");
  const [interventionsUsed, setInterventionsUsed] = useState("");
  const [clientResponse, setClientResponse] = useState("");
  const [nextSessionPlan, setNextSessionPlan] = useState("");

  const [behaviorName, setBehaviorName] = useState("");
  const [antecedent, setAntecedent] = useState("");
  const [behaviorDescription, setBehaviorDescription] = useState("");
  const [consequence, setConsequence] = useState("");
  const [frequency, setFrequency] = useState("");
  const [duration, setDuration] = useState("");
  const [intensity, setIntensity] = useState("");
  const [functionHypothesis, setFunctionHypothesis] = useState("");
  const [interventionUsed, setInterventionUsed] = useState("");
  const [replacementBehavior, setReplacementBehavior] = useState("");

  const [programName, setProgramName] = useState("");
  const [programGoal, setProgramGoal] = useState("");
  const [programTargets, setProgramTargets] = useState("");
  const [promptLevel, setPromptLevel] = useState("");
  const [masteryCriteria, setMasteryCriteria] = useState("");
  const [trialData, setTrialData] = useState("");
  const [programNotes, setProgramNotes] = useState("");

  const sectionContent = {
    notes: {
      title: "Session Notes",
      description: "Create clear ABA session notes from structured session details.",
    },
    interventions: {
      title: "Behavior Interventions",
      description:
        "Collect behavior data and generate intervention recommendations from ABC details.",
    },
    programs: {
      title: "Skill Programs",
      description:
        "Create teaching programs with targets, prompting, mastery criteria, trial data, and notes.",
    },
    clients: {
      title: "Clients / Learners",
      description:
        "Create and manage learner profiles for goals, behaviors, programs, and session history.",
    },
    history: {
      title: "History",
      description: "Filter and review previous notes, behavior data, and skill programs.",
    },
    profile: {
      title: "Profile / Settings",
      description: "Manage account and workspace settings.",
    },
  };

  const currentSection = sectionContent[mode];

  const filteredHistory = history.filter((item) => {
    const matchesClient =
      !historyClientFilter ||
      item.client?.toLowerCase().includes(historyClientFilter.toLowerCase());

    const matchesDate =
      !historyDateFilter || item.date?.includes(historyDateFilter);

    const matchesType = !historyTypeFilter || item.type === historyTypeFilter;

    const matchesStaff =
      !historyStaffFilter ||
      item.staffMember?.toLowerCase().includes(historyStaffFilter.toLowerCase());

    return matchesClient && matchesDate && matchesType && matchesStaff;
  });

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      await new Promise((resolve) => setTimeout(resolve, 500));

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (!session) {
        router.push("/login");
      }
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      if (!session) {
        router.push("/login");
      }
    });

    const savedClients = localStorage.getItem("aba-clients");
    if (savedClients) {
      setClients(JSON.parse(savedClients));
    }

    const savedHistory = localStorage.getItem("aba-history");
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  async function generateAI() {
    let finalPrompt = prompt;

    if (mode === "notes") {
      if (!sessionClient || !sessionDate) {
        alert("Please enter at least the client and session date.");
        return;
      }

      finalPrompt = `
Create a professional ABA session note using the information below.

Staff member: ${staffMember}
Client: ${sessionClient}
Date: ${sessionDate}
Location: ${sessionLocation}
Session duration: ${sessionDuration}
People present: ${peoplePresent}
Programs targeted: ${programsTargeted}
Behaviors observed: ${behaviorsObserved}
Interventions used: ${interventionsUsed}
Client response: ${clientResponse}
Plan for next session: ${nextSessionPlan}

Write the note in a clear, objective, professional ABA style.
      `;
    }

    if (mode === "interventions") {
      if (!behaviorName || !behaviorDescription) {
        alert("Please enter at least the behavior name and behavior description.");
        return;
      }

      finalPrompt = `
Create a professional ABA behavior intervention summary using the information below.

Staff member: ${staffMember}
Behavior name: ${behaviorName}
Antecedent: ${antecedent}
Behavior: ${behaviorDescription}
Consequence: ${consequence}
Frequency: ${frequency}
Duration: ${duration}
Intensity: ${intensity}
Function hypothesis: ${functionHypothesis}
Intervention used: ${interventionUsed}
Replacement behavior: ${replacementBehavior}

Include:
1. Objective behavior summary
2. Possible function of behavior
3. Recommended prevention strategies
4. Recommended response strategies
5. Replacement behavior teaching plan
6. Data collection recommendation

Write in clear, professional ABA language.
      `;
    }

    if (mode === "programs") {
      if (!programName || !programGoal) {
        alert("Please enter at least the program name and goal.");
        return;
      }

      finalPrompt = `
Create a professional ABA skill acquisition program using the information below.

Staff member: ${staffMember}
Program name: ${programName}
Goal: ${programGoal}
Targets: ${programTargets}
Prompt level: ${promptLevel}
Mastery criteria: ${masteryCriteria}
Trial data: ${trialData}
Notes: ${programNotes}

Include:
1. Program objective
2. Teaching procedure
3. Prompting strategy
4. Error correction procedure
5. Reinforcement plan
6. Mastery criteria
7. Data collection recommendation
8. Next steps

Write in clear, professional ABA language.
      `;
    }

    setLoading(true);
    setResult("");

    const res = await fetch("/api/generate-note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, prompt: finalPrompt }),
    });

    const data = await res.json();
    setResult(data.result);

    let entryClient = "";
    let entryType = mode;

    if (mode === "notes") {
      entryClient = sessionClient;
      entryType = "Session Note";
    }

    if (mode === "interventions") {
      entryClient = behaviorName;
      entryType = "Behavior Data";
    }

    if (mode === "programs") {
      entryClient = programName;
      entryType = "Skill Program";
    }

    const newEntry = {
      mode,
      type: entryType,
      client: entryClient,
      staffMember,
      prompt: finalPrompt,
      result: data.result,
      date: new Date().toLocaleString(),
    };

    const updatedHistory = [newEntry, ...history];
    setHistory(updatedHistory);
    localStorage.setItem("aba-history", JSON.stringify(updatedHistory));

    setLoading(false);
  }

  function saveClient() {
    if (!clientName) {
      alert("Please enter the client name.");
      return;
    }

    const newClient = {
      clientName,
      dateOfBirth,
      diagnosis,
      caregiverName,
      goals,
      behaviors,
      skillPrograms,
      sessionHistory: [],
      createdAt: new Date().toLocaleString(),
    };

    const updatedClients = [newClient, ...clients];
    setClients(updatedClients);
    localStorage.setItem("aba-clients", JSON.stringify(updatedClients));

    setClientName("");
    setDateOfBirth("");
    setDiagnosis("");
    setCaregiverName("");
    setGoals("");
    setBehaviors("");
    setSkillPrograms("");
  }

  async function logOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const sidebarButtonStyle = {
    width: "100%",
    display: "block",
    padding: "10px 12px",
    marginBottom: 10,
    border: "none",
    borderRadius: 6,
    background: "rgba(255, 255, 255, 0.14)",
    color: "white",
    fontSize: 15,
    textAlign: "left" as const,
    cursor: "pointer",
  };

  const inputStyle = {
    padding: 12,
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 15,
  };

  const outputStyle = {
    whiteSpace: "pre-wrap" as const,
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 16,
  };

  return (
    <main style={{ display: "flex", minHeight: "100vh", fontFamily: "Arial" }}>
      <aside style={{ width: 220, position: "relative", overflow: "hidden", padding: 20, color: "white", background: "#111827" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(17, 24, 39, 0.78), rgba(17, 24, 39, 0.78)), url('/login-banner.jpg')", backgroundSize: "cover", backgroundPosition: "center", transform: "rotate(180deg) scale(1.2)" }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <h2 style={{ marginTop: 0, marginBottom: 24 }}>ABA AI</h2>

          <button style={sidebarButtonStyle} onClick={() => setMode("notes")}>Session Notes</button>
          <button style={sidebarButtonStyle} onClick={() => setMode("interventions")}>Behavior Interventions</button>
          <button style={sidebarButtonStyle} onClick={() => setMode("programs")}>Skill Programs</button>
          <button style={sidebarButtonStyle} onClick={() => setMode("clients")}>Clients / Learners</button>
          <button style={sidebarButtonStyle} onClick={() => setMode("history")}>History</button>
          <button style={sidebarButtonStyle} onClick={() => setMode("profile")}>Profile / Settings</button>

          <button onClick={logOut} style={{ ...sidebarButtonStyle, marginTop: 24, background: "rgba(239, 68, 68, 0.85)" }}>
            Log out
          </button>
        </div>
      </aside>

      <section style={{ flex: 1, padding: 30 }}>
        <h1 style={{ marginBottom: 6 }}>{currentSection.title}</h1>
        <p style={{ marginTop: 0, color: "#4b5563" }}>{currentSection.description}</p>

        {mode === "notes" && (
          <>
            <div style={{ display: "grid", gap: 12, maxWidth: 800 }}>
              <input placeholder="Staff member" value={staffMember} onChange={(e) => setStaffMember(e.target.value)} style={inputStyle} />
              <input placeholder="Client" value={sessionClient} onChange={(e) => setSessionClient(e.target.value)} style={inputStyle} />
              <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} style={inputStyle} />
              <input placeholder="Location" value={sessionLocation} onChange={(e) => setSessionLocation(e.target.value)} style={inputStyle} />
              <input placeholder="Session duration" value={sessionDuration} onChange={(e) => setSessionDuration(e.target.value)} style={inputStyle} />
              <input placeholder="People present" value={peoplePresent} onChange={(e) => setPeoplePresent(e.target.value)} style={inputStyle} />
              <textarea placeholder="Programs targeted" value={programsTargeted} onChange={(e) => setProgramsTargeted(e.target.value)} style={{ ...inputStyle, minHeight: 80 }} />
              <textarea placeholder="Behaviors observed" value={behaviorsObserved} onChange={(e) => setBehaviorsObserved(e.target.value)} style={{ ...inputStyle, minHeight: 80 }} />
              <textarea placeholder="Interventions used" value={interventionsUsed} onChange={(e) => setInterventionsUsed(e.target.value)} style={{ ...inputStyle, minHeight: 80 }} />
              <textarea placeholder="Client response" value={clientResponse} onChange={(e) => setClientResponse(e.target.value)} style={{ ...inputStyle, minHeight: 80 }} />
              <textarea placeholder="Plan for next session" value={nextSessionPlan} onChange={(e) => setNextSessionPlan(e.target.value)} style={{ ...inputStyle, minHeight: 80 }} />

              <button onClick={generateAI}>{loading ? "Generating..." : "Generate Session Note"}</button>
            </div>

            {result && (
              <div style={{ marginTop: 24 }}>
                <h2>Generated Session Note</h2>
                <pre style={outputStyle}>{result}</pre>
              </div>
            )}
          </>
        )}

        {mode === "interventions" && (
          <>
            <div style={{ display: "grid", gap: 12, maxWidth: 800 }}>
              <input placeholder="Staff member" value={staffMember} onChange={(e) => setStaffMember(e.target.value)} style={inputStyle} />
              <input placeholder="Behavior name" value={behaviorName} onChange={(e) => setBehaviorName(e.target.value)} style={inputStyle} />
              <textarea placeholder="Antecedent" value={antecedent} onChange={(e) => setAntecedent(e.target.value)} style={{ ...inputStyle, minHeight: 80 }} />
              <textarea placeholder="Behavior" value={behaviorDescription} onChange={(e) => setBehaviorDescription(e.target.value)} style={{ ...inputStyle, minHeight: 80 }} />
              <textarea placeholder="Consequence" value={consequence} onChange={(e) => setConsequence(e.target.value)} style={{ ...inputStyle, minHeight: 80 }} />
              <input placeholder="Frequency" value={frequency} onChange={(e) => setFrequency(e.target.value)} style={inputStyle} />
              <input placeholder="Duration" value={duration} onChange={(e) => setDuration(e.target.value)} style={inputStyle} />
              <input placeholder="Intensity" value={intensity} onChange={(e) => setIntensity(e.target.value)} style={inputStyle} />
              <textarea placeholder="Function hypothesis" value={functionHypothesis} onChange={(e) => setFunctionHypothesis(e.target.value)} style={{ ...inputStyle, minHeight: 80 }} />
              <textarea placeholder="Intervention used" value={interventionUsed} onChange={(e) => setInterventionUsed(e.target.value)} style={{ ...inputStyle, minHeight: 80 }} />
              <textarea placeholder="Replacement behavior" value={replacementBehavior} onChange={(e) => setReplacementBehavior(e.target.value)} style={{ ...inputStyle, minHeight: 80 }} />

              <button onClick={generateAI}>{loading ? "Generating..." : "Generate Behavior Intervention"}</button>
            </div>

            {result && (
              <div style={{ marginTop: 24 }}>
                <h2>Generated Behavior Intervention</h2>
                <pre style={outputStyle}>{result}</pre>
              </div>
            )}
          </>
        )}

        {mode === "programs" && (
          <>
            <div style={{ display: "grid", gap: 12, maxWidth: 800 }}>
              <input placeholder="Staff member" value={staffMember} onChange={(e) => setStaffMember(e.target.value)} style={inputStyle} />
              <input placeholder="Program name" value={programName} onChange={(e) => setProgramName(e.target.value)} style={inputStyle} />
              <textarea placeholder="Goal" value={programGoal} onChange={(e) => setProgramGoal(e.target.value)} style={{ ...inputStyle, minHeight: 80 }} />
              <textarea placeholder="Targets" value={programTargets} onChange={(e) => setProgramTargets(e.target.value)} style={{ ...inputStyle, minHeight: 80 }} />
              <input placeholder="Prompt level" value={promptLevel} onChange={(e) => setPromptLevel(e.target.value)} style={inputStyle} />
              <textarea placeholder="Mastery criteria" value={masteryCriteria} onChange={(e) => setMasteryCriteria(e.target.value)} style={{ ...inputStyle, minHeight: 80 }} />
              <textarea placeholder="Trial data" value={trialData} onChange={(e) => setTrialData(e.target.value)} style={{ ...inputStyle, minHeight: 80 }} />
              <textarea placeholder="Notes" value={programNotes} onChange={(e) => setProgramNotes(e.target.value)} style={{ ...inputStyle, minHeight: 80 }} />

              <div style={{ border: "1px dashed #9ca3af", borderRadius: 8, padding: 16, background: "#f9fafb" }}>
                <strong>Graph</strong>
                <p style={{ marginBottom: 0 }}>Graphing will be added later. For now, enter trial data above.</p>
              </div>

              <button onClick={generateAI}>{loading ? "Generating..." : "Generate Skill Program"}</button>
            </div>

            {result && (
              <div style={{ marginTop: 24 }}>
                <h2>Generated Skill Program</h2>
                <pre style={outputStyle}>{result}</pre>
              </div>
            )}
          </>
        )}

        {mode === "clients" && (
          <div>
            <div style={{ display: "grid", gap: 12, maxWidth: 700 }}>
              <input placeholder="Client name" value={clientName} onChange={(e) => setClientName(e.target.value)} style={inputStyle} />
              <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} style={inputStyle} />
              <input placeholder="Diagnosis" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} style={inputStyle} />
              <input placeholder="Caregiver name" value={caregiverName} onChange={(e) => setCaregiverName(e.target.value)} style={inputStyle} />
              <textarea placeholder="Goals" value={goals} onChange={(e) => setGoals(e.target.value)} style={{ ...inputStyle, minHeight: 80 }} />
              <textarea placeholder="Behaviors" value={behaviors} onChange={(e) => setBehaviors(e.target.value)} style={{ ...inputStyle, minHeight: 80 }} />
              <textarea placeholder="Skill programs" value={skillPrograms} onChange={(e) => setSkillPrograms(e.target.value)} style={{ ...inputStyle, minHeight: 80 }} />

              <button onClick={saveClient}>Save Client</button>
            </div>

            <h2 style={{ marginTop: 30 }}>Saved Clients</h2>

            {clients.length === 0 ? (
              <p>No clients saved yet.</p>
            ) : (
              clients.map((client, i) => (
                <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginBottom: 12, background: "#f9fafb" }}>
                  <h3>{client.clientName}</h3>
                  <p><strong>Date of birth:</strong> {client.dateOfBirth}</p>
                  <p><strong>Diagnosis:</strong> {client.diagnosis}</p>
                  <p><strong>Caregiver:</strong> {client.caregiverName}</p>
                  <p><strong>Goals:</strong> {client.goals}</p>
                  <p><strong>Behaviors:</strong> {client.behaviors}</p>
                  <p><strong>Skill programs:</strong> {client.skillPrograms}</p>
                </div>
              ))
            )}
          </div>
        )}

        {mode === "history" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 20 }}>
              <input placeholder="Filter by client" value={historyClientFilter} onChange={(e) => setHistoryClientFilter(e.target.value)} style={inputStyle} />
              <input placeholder="Filter by date" value={historyDateFilter} onChange={(e) => setHistoryDateFilter(e.target.value)} style={inputStyle} />
              <select value={historyTypeFilter} onChange={(e) => setHistoryTypeFilter(e.target.value)} style={inputStyle}>
                <option value="">All types</option>
                <option value="Session Note">Session notes</option>
                <option value="Behavior Data">Behavior data</option>
                <option value="Skill Program">Skill programs</option>
              </select>
              <input placeholder="Filter by staff" value={historyStaffFilter} onChange={(e) => setHistoryStaffFilter(e.target.value)} style={inputStyle} />
            </div>

            {filteredHistory.length === 0 ? (
              <p>No matching history yet.</p>
            ) : (
              filteredHistory.map((item, i) => (
                <div key={i} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginBottom: 14, background: "#f9fafb" }}>
                  <strong>{item.type || item.mode}</strong>
                  <p><strong>Client:</strong> {item.client || "Not listed"}</p>
                  <p><strong>Staff:</strong> {item.staffMember || "Not listed"}</p>
                  <p><strong>Date:</strong> {item.date}</p>
                  <p>{item.prompt}</p>
                  <pre style={{ whiteSpace: "pre-wrap" }}>{item.result}</pre>
                </div>
              ))
            )}
          </div>
        )}

        {mode === "profile" && (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 20, background: "#f9fafb" }}>
            <h2>Account Settings</h2>
            <p>Profile settings will go here.</p>
            <button onClick={logOut}>Log out</button>
          </div>
        )}
      </section>
    </main>
  );
}