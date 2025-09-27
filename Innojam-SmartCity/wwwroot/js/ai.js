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
    const apiKey = "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";  // Your key here
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







