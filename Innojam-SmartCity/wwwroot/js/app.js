import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAJfQftOUOUmIxZUFvLQCrR4sIWkJLNIlg",
    authDomain: "smart-city-ad271.firebaseapp.com",
    projectId: "smart-city-ad271",
    storageBucket: "smart-city-ad271.firebasestorage.app",
    messagingSenderId: "179825192263",
    appId: "1:179825192263:web:48b013c4646878d770f062",
    measurementId: "G-CHM4SZBZDZ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Tab Navigation
const tabButtons = document.querySelectorAll("button.tabBtn");
const tabContents = document.querySelectorAll(".tabContent");

tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        // Reset active states
        tabButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        const targetId = btn.getAttribute("data-target");
        tabContents.forEach(tc => {
            tc.id === targetId ? tc.classList.add("activeTab") : tc.classList.remove("activeTab");
        });

        if (targetId === "tabPatientList") loadPatientList();
    });
});

// Load Patient List
async function loadPatientList() {
    const patientListContainer = document.getElementById("patientList");
    try {
        const querySnapshot = await getDocs(collection(db, "patient_lab_reports"));
        patientListContainer.innerHTML = "";

        querySnapshot.forEach(doc => {
            const patient = doc.data();
            const listItem = createPatientItem(patient);
            patientListContainer.appendChild(listItem);
        });
    } catch (error) {
        console.error("Error loading patient list:", error);
        patientListContainer.innerHTML = "<p>Error loading patients.</p>";
    }
}

// Create patient list item
function createPatientItem(patient) {
    const listItem = document.createElement("div");
    listItem.classList.add("patientItem");
    listItem.style.cursor = "pointer";

    const infoDiv = document.createElement("div");
    infoDiv.classList.add("patientInfo");

    const nameSpan = document.createElement("span");
    nameSpan.classList.add("patientName");
    nameSpan.textContent = patient.name;

    const nricSpan = document.createElement("span");
    nricSpan.classList.add("patientNric");
    nricSpan.textContent = `(${patient.nric})`;

    infoDiv.appendChild(nameSpan);
    infoDiv.appendChild(nricSpan);
    listItem.appendChild(infoDiv);

    // Add click event
    listItem.addEventListener("click", () => loadPatientDetails(patient.nric, patient.name));

    return listItem;
}

// Load and Render Data for Charts
export async function loadAndRenderData() {
    try {
        const docsSnapshot = await getDocs(collection(db, "patient_lab_reports"));
        const data = docsSnapshot.docs.map(doc => doc.data());

        // Aggregate Data
        const aggregatedData = aggregateData(data);

        // Render Charts
        renderCharts(aggregatedData);
    } catch (err) {
        alert("Error loading data: " + err.message);
    }
}


// Aggregate Data for Reports
function aggregateData(data) {
    const aggregatedData = {
        testTypeCounts: {},
        locationCounts: {},
        familyHistoryCounts: { father: {}, mother: {}, siblings: {} },
        transferCounts: { TransferIn: 0, TransferOut: 0, TransferOther: 0, NotTransferred: 0 },
        monthlyCounts: {}
    };

    const currentHospital = "Cyberjaya Hospital";

    data.forEach(d => {
        // Test Types
        if (d.testType) aggregatedData.testTypeCounts[d.testType] = (aggregatedData.testTypeCounts[d.testType] || 0) + 1;

        // Locations
        if (d.address) {
            let loc = d.address.split(",").slice(-2, -1)[0] || d.address;
            aggregatedData.locationCounts[loc.trim()] = (aggregatedData.locationCounts[loc.trim()] || 0) + 1;
        }

        // Family History
        if (d.familyMedicalHistory) {
            ["father", "mother", "siblings"].forEach(rel => {
                const conditions = d.familyMedicalHistory[rel];
                if (conditions) {
                    const conditionList = Array.isArray(conditions) ? conditions : [conditions];
                    conditionList.forEach(c => {
                        if (c && c.trim() && c.toLowerCase() !== 'none') {
                            aggregatedData.familyHistoryCounts[rel][c] = (aggregatedData.familyHistoryCounts[rel][c] || 0) + 1;
                        }
                    });
                }
            });
        }

        // Transfer Info
        if (d.transferInfo?.isTransferred) {
            if (d.transferInfo.toHospital === currentHospital) aggregatedData.transferCounts.TransferIn++;
            else if (d.transferInfo.fromHospital === currentHospital) aggregatedData.transferCounts.TransferOut++;
            else aggregatedData.transferCounts.TransferOther++;
        } else {
            aggregatedData.transferCounts.NotTransferred++;
        }

        // Monthly Report Count
        const dateStr = d.reportDate || d.historicalLabReports?.[0]?.reportDate;
        if (dateStr) {
            const month = new Date(dateStr).toISOString().slice(0, 7); // YYYY-MM
            aggregatedData.monthlyCounts[month] = (aggregatedData.monthlyCounts[month] || 0) + 1;
        }
    });

    return aggregatedData;
}

// Render Charts
function renderCharts(aggregatedData) {
    // --- Chart 1: Test Types (Bar)
    const ctx1 = document.getElementById("labTestTypeChart").getContext("2d");
    new Chart(ctx1, {
        type: "bar",
        data: {
            labels: Object.keys(aggregatedData.testTypeCounts),
            datasets: [{
                label: "# of Reports",
                data: Object.values(aggregatedData.testTypeCounts),
                backgroundColor: "rgba(54, 162, 235, 0.6)",
                borderColor: "rgba(54, 162, 235, 1)",
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: { title: { display: true, text: 'Diagnosis' } },
            scales: { y: { beginAtZero: true } }
        }
    });

    // --- Chart 2: Locations (Pie)
    const ctx2 = document.getElementById("labLocationChart").getContext("2d");
    new Chart(ctx2, {
        type: "pie",
        data: {
            labels: Object.keys(aggregatedData.locationCounts),
            datasets: [{
                data: Object.values(aggregatedData.locationCounts),
                backgroundColor: ["#36A2EB", "#FF6384", "#FFCE56", "#4BC0C0", "#9966FF", "#FF9F40", "#A9A9A9"]
            }]
        },
        options: {
            plugins: { title: { display: true, text: 'Reports by Location' } }
        }
    });

    // --- Chart 3: Family Medical History (Bar)
    const combinedFamilyConditions = aggregateFamilyHistory(aggregatedData.familyHistoryCounts);
    const ctx3 = document.getElementById("familyHistoryChart").getContext("2d");
    new Chart(ctx3, {
        type: "bar",
        data: {
            labels: Object.keys(combinedFamilyConditions),
            datasets: [{
                label: "Occurrences in Family",
                data: Object.values(combinedFamilyConditions),
                backgroundColor: "rgba(255, 159, 64, 0.6)",
                borderColor: "rgba(255, 159, 64, 1)",
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: { title: { display: true, text: 'Common Family Medical History' } },
            scales: { y: { beginAtZero: true } }
        }
    });

    // --- Chart 4: Hospital Transfers (Bar)
    const ctx4 = document.getElementById("transferChart").getContext("2d");
    new Chart(ctx4, {
        type: "bar",
        data: {
            labels: ["Transfer In", "Transfer Out", "Transfer Other", "Not Transferred"],
            datasets: [{
                label: "# of Patients",
                data: [
                    aggregatedData.transferCounts.TransferIn,
                    aggregatedData.transferCounts.TransferOut,
                    aggregatedData.transferCounts.TransferOther,
                    aggregatedData.transferCounts.NotTransferred
                ],
                backgroundColor: ["#4caf50", "#f44336", "#ff9800", "#9e9e9e"]
            }]
        },
        options: {
            plugins: { title: { display: true, text: 'Hospital Transfer Overview' } },
            responsive: true,
            scales: { y: { beginAtZero: true } }
        }
    });

    // --- Chart 5: Monthly Report Distribution (Line)
    const ctx5 = document.getElementById("monthlyReportChart").getContext("2d");
    new Chart(ctx5, {
        type: "line",
        data: {
            labels: Object.keys(aggregatedData.monthlyCounts),
            datasets: [{
                label: "Reports per Month",
                data: Object.values(aggregatedData.monthlyCounts),
                borderColor: "#ff5733",
                fill: false,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            plugins: { title: { display: true, text: 'Monthly Report Distribution' } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

// Aggregate Family History
function aggregateFamilyHistory(familyHistory) {
    const combined = {};
    Object.values(familyHistory).forEach(family => {
        Object.entries(family).forEach(([condition, count]) => {
            combined[condition] = (combined[condition] || 0) + count;
        });
    });
    return combined;
}





//////////////////////////////////////////
//patient listing and detail






// Patient detail
let currentPatientReports = [], currentPatientId = null, currentPatientName = null;

async function loadPatientDetails(nric, name) {
    document.getElementById("selectedPatientName").textContent = `${name} (${nric})`;
    const reportsDiv = document.getElementById("patientReports");
    const analysisBox = document.getElementById("patientAIAnalysisBox");
    document.getElementById("patientDetail").style.display = "block";
    reportsDiv.textContent = "Loading reports...";
    analysisBox.textContent = "";

    try {
        const q = query(collection(db, "patient_lab_reports"), where("nric", "==", nric));
        const snapshot = await getDocs(q);
        const reports = [];
        snapshot.forEach(doc => reports.push(doc.data()));

        currentPatientReports = reports;
        currentPatientId = nric;
        currentPatientName = name;

        reportsDiv.innerHTML = reports.map((r, i) => {
            const symptoms = Array.isArray(r.symptoms) ? r.symptoms.join(", ") : (r.symptoms || "N/A");
            const remarks = r.remarks || "N/A";
            const chronic = Array.isArray(r.chronicConditions) ? r.chronicConditions.join(", ") : "N/A";
            const family = r.familyMedicalHistory
                ? `Father: ${r.familyMedicalHistory.father}, Mother: ${r.familyMedicalHistory.mother}, Siblings: ${r.familyMedicalHistory.siblings}`
                : "N/A";
            const transferInfo = r.transferInfo?.isTransferred
                ? `Transferred from ${r.transferInfo.fromHospital} to ${r.transferInfo.toHospital} on ${r.transferInfo.transferDate}. Reason: ${r.transferInfo.reason}`
                : "No transfer";

            return `
			<div>
			  <strong>Report ${i + 1}</strong><br>
			  <strong>Test Type:</strong> ${r.testType || "N/A"}<br>
			  <strong>Result:</strong> ${r.testResult || "N/A"}<br>
			  <strong>Date:</strong> ${r.reportDate || "N/A"}<br>
			  <strong>Symptoms:</strong> ${symptoms}<br>
			  <strong>Remarks:</strong> ${remarks}<br>
			  <strong>Chronic Conditions:</strong> ${chronic}<br>
			  <strong>Family History:</strong> ${family}<br>
			  <strong>Transfer Info:</strong> ${transferInfo}
			</div>
			${i < reports.length - 1 ? '<hr style="margin:20px 0;">' : ''}
		  `;
        }).join("");


    } catch (err) {
        reportsDiv.textContent = "Error: " + err.message;
    }
}



//////////////////////////////////////////
//patient listing and detail (ai)




async function generateAIAnalysisWithGroq(prompt) {
    const apiKey = API_KEY ;  // Your key here
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'openai/gpt-oss-20b',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.5,
            max_tokens: 800 
        })
    });

    const json = await resp.json();
    if (json.choices?.[0]?.message?.content) {
        return json.choices[0].message.content;
    } else {
        throw new Error("No response from AI");
    }
}


// Patient AI Analysis buttons
function getReportsText() {
    return currentPatientReports.map(r => {
        const family = r.familyMedicalHistory
            ? `Family History - Father: ${r.familyMedicalHistory.father || 'N/A'}, Mother: ${r.familyMedicalHistory.mother || 'N/A'}, Siblings: ${r.familyMedicalHistory.siblings || 'N/A'}`
            : "Family History: N/A";

        return `TestType: ${r.testType}, Location: ${r.location}, Date: ${r.reportDate}, Result: ${r.testResult}\n${family}`;
    }).join("\n\n");
}

document.getElementById("btnSummarizeBackground").onclick = async () => {
    const box = document.getElementById("patientAIAnalysisBox");
    box.textContent = "Summarizing background...";
    const prompt = `You are a medical AI assistant. Summarize patient background in markdown.

	Patient: ${currentPatientName} (${currentPatientId})
	Reports:
	${getReportsText()}

	Include:
	- Tests done
	- Hospital history
	- Any background insight
	`;

    try {
        const result = await generateAIAnalysisWithGroq(prompt);
        box.innerHTML = marked.parse(result);
    } catch (err) {
        box.textContent = "Error: " + err.message;
    }
};

document.getElementById("btnSummarizePrediction").onclick = async () => {
    const box = document.getElementById("patientAIAnalysisBox");
    box.textContent = "Generating prediction...";
    const prompt = `Based on these lab reports, predict potential future health issues for this patient.

	Patient: ${currentPatientName} (${currentPatientId})
	Reports:
	${getReportsText()}

	Output in markdown format.
	`;

    try {
        const result = await generateAIAnalysisWithGroq(prompt);
        box.innerHTML = marked.parse(result);
    } catch (err) {
        box.textContent = "Error: " + err.message;
    }
};

document.getElementById("btnPreventIllness").onclick = async () => {
    const box = document.getElementById("patientAIAnalysisBox");
    box.textContent = "Generating prevention advice...";
    const prompt = `Based on the following lab reports, give prevention advice to avoid future health issues.

	Patient: ${currentPatientName} (${currentPatientId})
	Reports:
	${getReportsText()}

	Give personalized recommendations in markdown format.
	`;

    try {
        const result = await generateAIAnalysisWithGroq(prompt);
        box.innerHTML = marked.parse(result);
    } catch (err) {
        box.textContent = "Error: " + err.message;
    }
};

document.getElementById("generateAIAnalysisBtn").onclick = async () => {
    const box = document.getElementById("aiAnalysisBox");
    const btn = document.getElementById("generateAIAnalysisBtn");
    btn.disabled = true;
    box.textContent = "Analyzing overall lab reports...";

    try {
        const snapshot = await getDocs(collection(db, "patient_lab_reports"));
        const allReports = [];
        snapshot.forEach(doc => allReports.push(doc.data()));

        // Aggregate test types
        const testTypeCounts = {};
        allReports.forEach(r => {
            if (r.testType) testTypeCounts[r.testType] = (testTypeCounts[r.testType] || 0) + 1;
        });
        const topTestTypes = Object.entries(testTypeCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([testType, count]) => `- ${testType}: ${count} reports`)
            .join("\n");

        // Aggregate family history
        const familyConditionsCounts = { father: {}, mother: {}, siblings: {} };
        allReports.forEach(r => {
            if (r.familyMedicalHistory) {
                ["father", "mother", "siblings"].forEach(rel => {
                    const conditions = r.familyMedicalHistory[rel];
                    if (conditions) {
                        const list = Array.isArray(conditions) ? conditions : [conditions];
                        list.forEach(cond => {
                            if (cond && cond.trim()) familyConditionsCounts[rel][cond] = (familyConditionsCounts[rel][cond] || 0) + 1;
                        });
                    }
                });
            }
        });
        function summarizeFamilyHistory(familyCounts) {
            return ["father", "mother", "siblings"].map(rel => {
                const condCounts = familyCounts[rel];
                const sorted = Object.entries(condCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([cond, count]) => `${cond} (${count})`)
                    .join(", ");
                return `${rel.charAt(0).toUpperCase() + rel.slice(1)}: ${sorted || "N/A"}`;
            }).join("\n");
        }
        const familySummary = summarizeFamilyHistory(familyConditionsCounts);

        // Aggregate transfers
        const transferCounts = {};
        allReports.forEach(r => {
            if (r.transferInfo && r.transferInfo.isTransferred) {
                const reason = r.transferInfo.reason || "Unknown";
                transferCounts[reason] = (transferCounts[reason] || 0) + 1;
            }
        });
        const transferSummary = Object.entries(transferCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([reason, count]) => `- ${reason}: ${count} transfers`)
            .join("\n") || "No transfers recorded.";

        // Aggregate monthly counts
        const monthlyCounts = {};
        allReports.forEach(r => {
            const month = r.reportDate?.slice(0, 7);
            if (month) monthlyCounts[month] = (monthlyCounts[month] || 0) + 1;
        });
        const monthlyTrend = Object.entries(monthlyCounts)
            .sort()
            .map(([month, count]) => `- ${month}: ${count} reports`)
            .join("\n") || "No monthly data available.";

        // Construct prompt with new info
        const prompt = `You are a medical data AI assistant. Given the following data about patient lab reports, transfers, and monthly trends, provide an overall analysis and suggestions for health monitoring and hospital management.

	Top 5 Lab Test Types by number of reports:
	${topTestTypes}

	Summary of common family medical conditions:
	${familySummary}

	Patient Transfers by Reason:
	${transferSummary}

	Monthly Report Volume:
	${monthlyTrend}

	Note: Data set has ${allReports.length} total reports.

	Highlight any concerns with patient transfers that suggest gaps in care or capacity.
	Identify rising health risks indicated by monthly trends.
	Provide actionable recommendations to reduce hospital transfers and improve patient outcomes.
	`;

        const result = await generateAIAnalysisWithGroq(prompt);
        box.innerHTML = marked.parse(result);

    } catch (err) {
        box.textContent = `Error occurred while generating AI analysis. Please try again later. (${err.message})`;
    } finally {
        btn.disabled = false;
    }
};


// ============================
// Simulate random device data
// ============================
function generateRandomDeviceData() {
    const randomInRange = (min, max) => (Math.random() * (max - min) + min).toFixed(1);

    return {
        timestamp: new Date().toISOString(),
        heartRate: Math.floor(randomInRange(60, 100)),       // bpm
        bloodPressure: `${Math.floor(randomInRange(110, 140))}/${Math.floor(randomInRange(70, 90))}`, // mmHg
        oxygenSaturation: Math.floor(randomInRange(95, 100)), // %
        bodyTemperature: randomInRange(36.5, 37.5),          // °C
        steps: Math.floor(randomInRange(0, 5000)),           // daily steps
        sleepHours: randomInRange(4, 8)                      // hours
    };
}

// Utility to format device data as text for AI
function formatDeviceDataForAI(readings) {
    return readings.map(r =>
        `[${r.timestamp}] HR: ${r.heartRate} bpm | BP: ${r.bloodPressure} | SpO2: ${r.oxygenSaturation}% | Temp: ${r.bodyTemperature}°C | Steps: ${r.steps} | Sleep: ${r.sleepHours}h`
    ).join("\n");
}

// ============================
// Button click: Summarize Device Data
// ============================
document.getElementById("btnDeviceData").onclick = async () => {
    const box = document.getElementById("patientAIAnalysisBox");
    box.textContent = "Summarizing device data...";

    // Generate 5 random device readings
    const deviceReadings = Array.from({ length: 5 }, generateRandomDeviceData);
    const formattedDeviceData = formatDeviceDataForAI(deviceReadings);

    const prompt = `You are a medical AI assistant. Summarize the following patient device data in markdown.

Patient: ${currentPatientName} (${currentPatientId})
Device Readings:
${formattedDeviceData}

Include:
- Key trends or abnormalities
- Any urgent alerts
- Suggestions for monitoring
`;

    try {
        const result = await generateAIAnalysisWithGroq(prompt);
        box.innerHTML = marked.parse(result);
    } catch (err) {
        box.textContent = "Error: " + err.message;
    }
};



// ============================
// Smart City Health AI Dashboard
// - Aggregated AI Summary
// - Per-Patient Trigger Actions
// ============================

document.getElementById("generateSmartCityBtn").onclick = async () => {
    const box = document.getElementById("smartCityBox");
    const actionsDiv = document.getElementById("smartCityActions");
    const btn = document.getElementById("generateSmartCityBtn");

    btn.disabled = true;
    box.textContent = "Analyzing smart city health data...";
    actionsDiv.innerHTML = "";
    actionsDiv.style.display = "none";

    try {
        // ======================
        // 1. Fetch patient reports
        // ======================
        const snapshot = await getDocs(collection(db, "patient_lab_reports"));
        const allReports = [];
        snapshot.forEach(doc => allReports.push(doc.data()));

        // ======================
        // 2. Aggregate patient data (to reduce AI token usage)
        // ======================
        const aggregated = {
            chronicConditions: {},  // { condition: [patients] }
            strokeCases: [],
            familyHeartRisk: []
        };

        allReports.forEach(patient => {
            // Chronic conditions
            patient.chronicConditions?.forEach(cond => {
                if (!aggregated.chronicConditions[cond]) aggregated.chronicConditions[cond] = [];
                aggregated.chronicConditions[cond].push({ name: patient.name, nric: patient.nric });
            });

            // Stroke cases
            const hasStroke = patient.historicalLabReports?.some(
                r => r.testType?.includes("Stroke") && r.testResult === "Positive"
            );
            if (hasStroke) aggregated.strokeCases.push({ name: patient.name, nric: patient.nric });

            // Family heart risk
            const fam = patient.familyMedicalHistory || {};
            if (fam.siblings === "Heart Disease" || fam.father === "Heart Disease") {
                aggregated.familyHeartRisk.push({ name: patient.name, nric: patient.nric });
            }
        });

        // ======================
        // 3. Utility: cap long lists
        // ======================
        const capList = (arr, max = 5) => {
            return arr.length <= max ? arr : [...arr.slice(0, max), { note: `+${arr.length - max} more` }];
        };

        Object.keys(aggregated.chronicConditions).forEach(cond => {
            aggregated.chronicConditions[cond] = capList(aggregated.chronicConditions[cond]);
        });
        aggregated.strokeCases = capList(aggregated.strokeCases);
        aggregated.familyHeartRisk = capList(aggregated.familyHeartRisk);

        // ======================
        // 4. AI Summary Prompt
        // ======================
        const prompt = `
You are a Smart City Health AI. Analyze aggregated patient data and summarize insights
across 5 dimensions.

Aggregated data (JSON):
${JSON.stringify(aggregated, null, 2)}

Provide output as a Markdown table with these columns:
Dimension | Patient(s) | Risk/Reason | Suggested Action

Rules:
- Dimension must be one of:
  Predictive Health Alerts,
  Preventive Programs, Family Risk Propagation.
- Patient(s): list sample names/NRIC or counts (e.g., "+12 more").
- Risk/Reason: explain briefly why they were flagged.
- Suggested Action: specific trigger (e.g., "Send SMS Alert", "Emergency Route").
- Keep it concise and dashboard-friendly.
`;

        const result = await generateAIAnalysisWithGroq(prompt);
        box.innerHTML = marked.parse(result);

        // ======================
        // 5. Render per-patient trigger buttons
        // ======================
        actionsDiv.style.display = "block";

        allReports.forEach(patient => {
            const triggers = [];

            // Predictive Health Alerts
            if (patient.chronicConditions?.includes("Asthma")) {
                triggers.push({ label: "Send SMS Alert", reason: "Asthma + AQI risk", icon: "✅" });
            }

            // Emergency Routing
            const hasStroke = patient.historicalLabReports?.some(
                r => r.testType?.includes("Stroke") && r.testResult === "Positive"
            );
            if (hasStroke) triggers.push({ label: "Trigger Emergency Route", reason: "Stroke history", icon: "🚑" });

            // Family Risk Propagation
            const fam = patient.familyMedicalHistory || {};
            if (fam.siblings === "Heart Disease" || fam.father === "Heart Disease") {
                triggers.push({ label: "Send Preventive Invite", reason: "Family heart disease risk", icon: "📩" });
            }

            if (triggers.length > 0) {
                const pDiv = document.createElement("div");
                pDiv.className = "patient-action-card";
                pDiv.innerHTML = `<h4>${patient.name} (${patient.nric})</h4>`;

                triggers.forEach(trigger => {
                    const btn = document.createElement("button");
                    btn.textContent = trigger.label;
                    btn.onclick = () => {
                        // Replace alert with actual API or action trigger
                        alert(`${trigger.icon} ${trigger.label} triggered for ${patient.name} (Reason: ${trigger.reason})`);
                    };
                    pDiv.appendChild(btn);
                });

                actionsDiv.appendChild(pDiv);
            }
        });

    } catch (err) {
        box.textContent = `Error generating Smart City analysis: ${err.message}`;
    } finally {
        btn.disabled = false;
    }
};


