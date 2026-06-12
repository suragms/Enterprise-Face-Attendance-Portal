import React, { useState, useEffect } from "react"
import { apiFetch } from "../../../lib/api"
import { 
  Cpu, 
  RefreshCw, 
  Terminal, 
  CheckCircle2, 
  AlertCircle, 
  Users,
  Clock,
  Play
} from "lucide-react"

interface Student {
  id: string
  roll_no: string
  name: string
  semester?: any
  department_name?: string
}

export const DeviceSyncSimulator: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [deviceId, setDeviceId] = useState("MAIN_GATE_TERMINAL_01")
  const [deviceName, setDeviceName] = useState("Main Campus Face Ingestion Terminal")
  const [scanHour, setScanHour] = useState("09:45") // defaults to 9:45 AM (Period II)
  const [confidence, setConfidence] = useState("94.5")
  
  const [syncing, setSyncing] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [consoleLogs, setConsoleLogs] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loadingStudents, setLoadingStudents] = useState(true)

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoadingStudents(true)
        const response = await apiFetch<any>("/students/?limit=100")
        if (response && response.results) {
          const mapped = response.results.map((item: any) => ({
            id: item.id,
            roll_no: item.roll_no,
            name: `${item.first_name} ${item.last_name || ""}`.trim(),
            department_name: item.department_name
          }))
          setStudents(mapped)
          // Default select the first 3 students for easy simulation
          setSelectedStudents(mapped.slice(0, 3).map((s: any) => s.roll_no))
        }
      } catch (err: any) {
        setError("Failed to load student roster. Please check permissions.")
        console.error(err)
      } finally {
        setLoadingStudents(false)
      }
    }
    fetchStudents()
  }, [])

  const appendLog = (msg: string) => {
    setConsoleLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])
  }

  const toggleStudent = (rollNo: string) => {
    setSelectedStudents(prev => 
      prev.includes(rollNo) 
        ? prev.filter(r => r !== rollNo) 
        : [...prev, rollNo]
    )
  }

  const handleRunSyncSimulation = async () => {
    if (selectedStudents.length === 0) {
      setError("Please select at least one student to simulate scans.")
      return
    }
    setError(null)
    setSyncing(true)
    setResults(null)
    setConsoleLogs([])

    // Simulate connection lag
    appendLog(`Initializing connection to BioEnable hardware terminal: ${deviceId}...`)
    
    setTimeout(async () => {
      appendLog("Connection established. Reading internal device log buffer...")
      
      const todayStr = new Date().toISOString().split("T")[0]
      const logsPayload = selectedStudents.map(roll => ({
        roll_no: roll,
        timestamp: `${todayStr}T${scanHour}:00`,
        status: "PRESENT",
        confidence_score: parseFloat(confidence)
      }))

      appendLog(`Found ${logsPayload.length} logs in queue. Transmitting payload to HexaAttender Cloud...`)

      try {
        const res = await apiFetch<any>("/attendance/engine/device-sync/", {
          method: "POST",
          body: {
            device_id: deviceId,
            device_name: deviceName,
            logs: logsPayload
          }
        })

        appendLog("Response received from attendance engine.")
        appendLog(`Successfully synchronized: ${res.synced_records} records.`)
        
        if (res.errors && res.errors.length > 0) {
          res.errors.forEach((err: string) => {
            appendLog(`[Warning] ${err}`)
          })
        }
        
        appendLog("Simulation complete. Device log queue cleared.")
        setResults(res)
      } catch (err: any) {
        console.error(err)
        appendLog(`[CRITICAL ERROR] Sync aborted: ${err.message || "Endpoint connection failed"}`)
        setError(err.message || "Failed to synchronize device logs.")
      } finally {
        setSyncing(false)
      }
    }, 1200)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-widest">
              <Cpu className="w-4 h-4" />
              <span>BioEnable Biometric Terminal</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight">Biometric Device Sync Console</h1>
            <p className="text-slate-300 text-xs max-w-xl">
              Simulate external hardware terminals pushing attendance logs. Logs are synced instantly, matching scheduled periods in the academic timetable.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Settings Panel */}
        <div className="lg:col-span-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Device Configurations</h2>
          
          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-xxs font-black text-slate-400 uppercase">Device ID</label>
              <input 
                className="rounded-lg border px-3 py-2 text-xs font-semibold text-slate-700" 
                value={deviceId} 
                onChange={(e) => setDeviceId(e.target.value)} 
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xxs font-black text-slate-400 uppercase">Device Location/Name</label>
              <input 
                className="rounded-lg border px-3 py-2 text-xs font-semibold text-slate-700" 
                value={deviceName} 
                onChange={(e) => setDeviceName(e.target.value)} 
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xxs font-black text-slate-400 uppercase flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Time of Scan
                </label>
                <input 
                  type="time"
                  className="rounded-lg border px-3 py-2 text-xs font-semibold text-slate-700" 
                  value={scanHour} 
                  onChange={(e) => setScanHour(e.target.value)} 
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xxs font-black text-slate-400 uppercase">Match Score %</label>
                <input 
                  type="number"
                  step="0.1"
                  className="rounded-lg border px-3 py-2 text-xs font-semibold text-slate-700" 
                  value={confidence} 
                  onChange={(e) => setConfidence(e.target.value)} 
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleRunSyncSimulation}
            disabled={syncing || selectedStudents.length === 0}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white rounded-xl text-xs font-black shadow transition-all flex items-center justify-center gap-2"
          >
            {syncing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Syncing Terminal Logs...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Simulate Device Log Sync</span>
              </>
            )}
          </button>
        </div>

        {/* Student Checkbox Selector */}
        <div className="lg:col-span-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col max-h-[420px]">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>Roster Capture ({selectedStudents.length} selected)</span>
            </h2>
            <button 
              onClick={() => setSelectedStudents(selectedStudents.length === students.length ? [] : students.map(s => s.roll_no))}
              className="text-xxs font-bold text-emerald-600 hover:text-emerald-700"
            >
              Toggle All
            </button>
          </div>

          {loadingStudents ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
              <p className="text-xxs text-slate-400">Loading student profiles...</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {students.map((student) => {
                const checked = selectedStudents.includes(student.roll_no)
                return (
                  <label 
                    key={student.roll_no}
                    className={`flex items-center gap-3 px-3 py-2 border rounded-xl cursor-pointer text-xs transition ${
                      checked 
                        ? "border-emerald-500 bg-emerald-50/20" 
                        : "border-slate-100 hover:bg-slate-50"
                    }`}
                  >
                    <input 
                      type="checkbox"
                      className="rounded text-emerald-600 focus:ring-emerald-500" 
                      checked={checked}
                      onChange={() => toggleStudent(student.roll_no)}
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-slate-700 truncate">{student.name}</p>
                      <p className="text-xxs font-semibold text-slate-400">Roll: {student.roll_no}</p>
                    </div>
                  </label>
                )
              })}
              {students.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">No students found.</p>
              )}
            </div>
          )}
        </div>

        {/* Sync Console Outputs */}
        <div className="lg:col-span-1 rounded-2xl border border-slate-200 bg-slate-950 p-5 shadow-sm text-slate-300 flex flex-col min-h-[320px] max-h-[420px]">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2 mb-3">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>Terminal Sync Console</span>
          </h2>
          
          <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-1.5 bg-black/45 p-3 rounded-lg border border-slate-900 pr-1">
            {consoleLogs.map((log, idx) => (
              <p 
                key={idx} 
                className={`${
                  log.includes("[Warning]") 
                    ? "text-amber-400" 
                    : log.includes("[CRITICAL") 
                      ? "text-rose-500" 
                      : log.includes("[Success]") 
                        ? "text-emerald-400 font-extrabold" 
                        : "text-slate-300"
                }`}
              >
                {log}
              </p>
            ))}
            {consoleLogs.length === 0 && (
              <p className="text-slate-500 italic">Simulated logs will stream here during synchronization...</p>
            )}
          </div>

          {results && (
            <div className="mt-3 p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-900/35 flex gap-2.5 items-start">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-[10px]">
                <p className="font-extrabold text-white">Sync Completed Successfully</p>
                <p className="text-slate-400 mt-0.5">
                  Synced Records: <span className="text-emerald-300 font-bold">{results.synced_records}</span> • Errors: <span className="text-rose-300 font-bold">{results.errors?.length || 0}</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
