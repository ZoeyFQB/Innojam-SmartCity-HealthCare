import { loadAndRenderData } from './app.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAJfQftOUOUmIxZUFvLQCrR4sIWkJLNIlg",
    authDomain: "smart-city-ad271.firebaseapp.com",
    projectId: "smart-city-ad271",
    storageBucket: "smart-city-ad271.firebasestorage.app",
    messagingSenderId: "179825192263",
    appId: "1:179825192263:web:48b013c4646878d770f062",
    measurementId: "G-CHM4SZBZDZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Initialize and load data when the page loads
window.addEventListener("load", loadAndRenderData);

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

// AI Analysis API call
async function generateAIAnalysisWithGroq(prompt) {
    const apiKey = API_KEY;  // Your key here
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
        })
    });

    const json = await resp.json();
    if (json.choices?.[0]?.message?.content) {
        return json.choices[0].message.content;
    } else {
        throw new Error("No response from AI");
    }
}

async function generateAIAnalysisWithGPT(prompt) {
    const apiKey = "";  // Your OpenAI API key
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "gpt-5",  // use gpt-5, or gpt-4.1, or gpt-4o-mini depending on your plan
            messages: [{ role: "user", content: prompt }],
            temperature: 0.5
        })
    });

    const json = await resp.json();
    if (json.choices?.[0]?.message?.content) {
        return json.choices[0].message.content;
    } else {
        throw new Error("No response from GPT");
    }
}

$("#btnLabTestAnalysis").on("click", async function (e) {
    const btn = $(this);
    btn.prop("disabled", true).text("Analyzing...");

    try {
        const snapshot = await getDocs(collection(db, "patient_lab_reports"));
        const patientList = [];
        snapshot.forEach(doc => patientList.push(doc.data()));

        const testCount = {};
        patientList.forEach(r => {
            if (r.testType) {
                testCount[r.testType] = (testCount[r.testType] || 0) + 1;
            }
        });

        const topTestTypes = Object.entries(testCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([type]) => type);

        const filteredList = patientList.filter(r =>
            topTestTypes.includes(r.testType)
        );

        console.log("Filtered List Count:", filteredList.length);

        // Group and summarize by testType
        const summary = {};
        filteredList.forEach(r => {
            const age = getAge(r.dob);
            if (!summary[r.testType]) summary[r.testType] = [];
            summary[r.testType].push(age);
        });

        const compactData = Object.fromEntries(
            Object.entries(summary).map(([testType, ages]) => [
                testType,
                {
                    count: ages.length,
                    avgAge: Math.round(ages.reduce((a, b) => a + b, 0) / ages.length),
                    minAge: Math.min(...ages),
                    maxAge: Math.max(...ages)
                }
            ])
        );

        const prompt = `You are a medical data AI assistant.  

Here is aggregated patient data for the top 2 lab test types:
${JSON.stringify(compactData, null, 2)}

Tasks:
1. Confirm that this summary only covers the top 2 test types.
2. For each test type, describe the age distribution (min, max, average).
3. Highlight health risks based on the age patterns.
4. Provide 2–3 recommendations for hospital monitoring or preventive care.

Output format:
- Use Markdown
- Start with a note: "Summary is limited to the top 2 test types"
- Then present a table: Test Type | Patient Count | Avg Age | Min Age | Max Age
- Follow with analysis and recommendations
- End with disclaimer: *This is an informational summary, not medical advice.*

        `;

        const result = await generateAIAnalysisWithGroq(prompt);
        $("#analysisLabTest").html(marked.parse(result));
    }
    catch (err) {
        $("#analysisLabTest").html(`Error occurred while generating AI analysis. Please try again later. (${err.message})`);
    }
    finally {
        $("#analysisLabTest").show();
        btn.prop("disabled", false).text("Generate Summary");
    }
});

function getAge(dob) {
    const birth = new Date(dob);
    const diff = Date.now() - birth.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

function sampleRecords(arr, n) {
    // simple first-n selection; could use random sampling if desired
    return arr.slice(0, n);
}

$("#btnLabLocationAnalysis").on("click", async function (e) {
    const btn = $(this);
    btn.prop("disabled", true).text("Analyzing...");

    try {
        const snapshot = await getDocs(collection(db, "patient_lab_reports"));
        const patientList = [];
        snapshot.forEach(doc => patientList.push(doc.data()));

        const testCount = {};
        patientList.forEach(r => {
            if (r.testType) {
                testCount[r.testType] = (testCount[r.testType] || 0) + 1;
            }
        });

        const topTestTypes = Object.entries(testCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([type]) => type);

        const filteredList = patientList.filter(r =>
            topTestTypes.includes(r.testType)
        );

        const sampledData = {};

        topTestTypes.forEach(testType => {
            const recordsOfType = filteredList.filter(r => r.testType === testType);
            sampledData[testType] = sampleRecords(recordsOfType, 20).map(r => ({
                address: r.address || "Unknown",
                hospital: r.transferInfo?.toHospital || "No Transfer"
            }));
        });

        const prompt = `You are a medical data AI assistant. Analyze the following patient transfer data: ${JSON.stringify(sampledData, null, 2)}

Tasks:
1. Check if patients' living places (addresses) show any patterns with specific test types.
2. Analyze if patients show preferences toward certain hospitals.
3. Summarize findings in a Markdown table or bullet points.

Notes:
- This analysis is based on a **sample of 20 records per test type**.
        `;

        const result = await generateAIAnalysisWithGroq(prompt);
        $("#analysisLabLocation").html(marked.parse(result));
    }
    catch (err) {
        $("#analysisLabLocation").html(`Error occurred while generating AI analysis. Please try again later. (${err.message})`);
    }
    finally {
        $("#analysisLabLocation").show();
        btn.prop("disabled", false).text("Generate Summary");
    }
});

$("#btnFamilyHistoryAnalysis").on("click", async function (e) {
    const btn = $(this);
    btn.prop("disabled", true).text("Analyzing...");

    try {
        const snapshot = await getDocs(collection(db, "patient_lab_reports"));
        const patientList = [];
        snapshot.forEach(doc => patientList.push(doc.data()));

        // Group patients by testType
        const patientsByTestType = {};
        patientList.forEach(p => {
            if (!patientsByTestType[p.testType]) patientsByTestType[p.testType] = [];
            patientsByTestType[p.testType].push(p);
        });

        // Sample 5-10 patients per test type
        const familyAnalysisData = {};
        Object.entries(patientsByTestType).forEach(([testType, patients]) => {
            const sampleSize = Math.min(5, patients.length);
            familyAnalysisData[testType] = sampleRecords(patients, sampleSize).map(p => ({
                name: p.name,
                testResult: p.testResult,
                familyMedicalHistory: p.familyMedicalHistory,
                remarks: p.remarks || "N/A"
            }));
        });

        const prompt = `You are a medical data AI assistant. Analyze the following patient data grouped by test type (5–10 patients per type): ${JSON.stringify(familyAnalysisData, null, 2)}

Tasks:
1. For each test type, identify diseases that **appear in family medical history**, suggesting possible inheritance.
2. Identify diseases that **do not appear in the family medical history**, suggesting non-inherited cases.
3. Summarize your findings in a Markdown table for each test type.

Notes:
- Highlight patterns that may help in early detection or prevention.
        `;

        const result = await generateAIAnalysisWithGroq(prompt);
        $("#analysisFamilyHistory").html(marked.parse(result));
    }
    catch (err) {
        $("#analysisFamilyHistory").html(`Error occurred while generating AI analysis. Please try again later. (${err.message})`);
    }
    finally {
        $("#analysisFamilyHistory").show();
        btn.prop("disabled", false).text("Generate Summary");
    }
});

$("#btnTransferAnalysis").on("click", async function (e) {
    const btn = $(this);
    btn.prop("disabled", true).text("Analyzing...");

    try {
        const snapshot = await getDocs(collection(db, "patient_lab_reports"));
        const patientList = [];
        snapshot.forEach(doc => patientList.push(doc.data()));

        // Group patients by test type for analysis
        const patientsByTestType = {};
        patientList.forEach(p => {
            if (!patientsByTestType[p.testType]) patientsByTestType[p.testType] = [];
            patientsByTestType[p.testType].push(p);
        });

        // Sample 5-10 patients per test type for transfer analysis
        const transferAnalysisData = {};
        Object.entries(patientsByTestType).forEach(([testType, patients]) => {
            const sampleSize = Math.min(5, patients.length);
            transferAnalysisData[testType] = sampleRecords(patients, sampleSize).map(p => ({
                name: p.name,
                testResult: p.testResult,
                transferInfo: p.transferInfo || { fromHospital: "N/A", toHospital: "N/A", reason: "N/A" },
                remarks: p.remarks || "N/A"
            }));
        });

        const prompt = `You are a medical data AI assistant. Analyze the following patient transfer data (5–10 patients per test type): ${JSON.stringify(transferAnalysisData, null, 2)}
Tasks:
1. Identify which test types have the **highest likelihood of transferring out** of a hospitaland explain possible reasons (fromHospital → toHospital).
2. Identify which test types have the **highest likelihood of being transferred in** to a hospital and explain possible reasons (incoming cases).
3. Summarize your findings in Markdown tables or bullet points:
   - Table 1: Transfer Out – Disease | From Hospital | To Hospital | Reason
   - Table 2: Transfer In – Disease | From Hospital | To Hospital | Reason
        `;

        const result = await generateAIAnalysisWithGroq(prompt);
        $("#analysisTransfer").html(marked.parse(result));
    }
    catch (err) {
        $("#analysisTransfer").html(`Error occurred while generating AI analysis. Please try again later. (${err.message})`);
    }
    finally {
        $("#analysisTransfer").show();
        btn.prop("disabled", false).text("Generate Summary");
    }
});
