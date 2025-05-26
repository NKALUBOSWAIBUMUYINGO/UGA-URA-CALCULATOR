// ====================== GLOBAL VARIABLES ======================
let chart; // Chart.js instance

// ====================== INITIALIZATION ======================
window.addEventListener('DOMContentLoaded', () => {
    loadFormState();
    displayHistory();
    updateDateTime();
    setInterval(updateDateTime, 1000);
});

// ====================== EVENT HANDLERS ======================
document.querySelectorAll('input, select').forEach(element => {
    element.addEventListener('input', () => validateInput(element));
    element.addEventListener('change', saveFormState);
});

// ====================== CORE CALCULATIONS ======================
function calculateNetPay() {
    // Inputs
    const grossInput = parseFloat(document.getElementById("grossSalary").value) || 0;
    const salaryType = document.getElementById("salaryType").value;
    const gross = salaryType === "annual" ? grossInput / 12 : grossInput;

    const housing = parseFloat(document.getElementById("housingAllowance").value) || 0;
    const transport = parseFloat(document.getElementById("transportAllowance").value) || 0;
    const otherDeductions = parseFloat(document.getElementById("otherDeductions").value) || 0;
    const totalAllowances = housing + transport;
    const taxableIncome = gross + totalAllowances;

    // Deductions
    const paye = calculatePAYE(taxableIncome);
    const { employee: nssfEmp, employer: nssfEr } = calculateNSSF(gross);
    const totalDeductions = paye + nssfEmp + otherDeductions;
    const netPay = gross + totalAllowances - totalDeductions;

    // Display
    updateDisplay(paye, nssfEmp, nssfEr, totalDeductions, netPay);
    updateChart(paye, nssfEmp, otherDeductions);
    addToHistory();
}

// PAYE Calculation Logic (Uganda)
function calculatePAYE(taxableIncome) {
    if (taxableIncome <= 235000) return 0;
    if (taxableIncome <= 335000) return 0.1 * (taxableIncome - 235000);
    if (taxableIncome <= 410000) return 10000 + 0.2 * (taxableIncome - 335000);
    return 25000 + 0.3 * (taxableIncome - 410000);
}

// NSSF Calculation
function calculateNSSF(gross) {
    const NSSF_CAP = 240000;
    const cappedSalary = Math.min(gross, NSSF_CAP);
    const option = document.getElementById("nssfOption").value;

    return {
        employee: {
            employee: cappedSalary * 0.05,
            both: cappedSalary * 0.05
        }[option] || 0,
        employer: {
            employer: cappedSalary * 0.10,
            both: cappedSalary * 0.10
        }[option] || 0
    };
}

// ====================== DISPLAY UPDATES ======================
function updateDisplay(paye, nssfEmp, nssfEr, totalDeductions, netPay) {
    document.getElementById("payeResult").innerText = paye.toFixed(2);
    document.getElementById("nssfEmployee").innerText = nssfEmp.toFixed(2);
    document.getElementById("nssfEmployer").innerText = nssfEr.toFixed(2);
    document.getElementById("totalDeductions").innerText = totalDeductions.toFixed(2);
    document.getElementById("netPay").innerText = netPay.toFixed(2);

    const gross = parseFloat(document.getElementById("grossSalary").value) || 0;
    const housing = parseFloat(document.getElementById("housingAllowance").value) || 0;
    const transport = parseFloat(document.getElementById("transportAllowance").value) || 0;
    explainPAYE(gross + housing + transport);
}

function explainPAYE(taxableIncome) {
    const format = num => num.toLocaleString("en-UG");
    let steps = "";

    if (taxableIncome > 410000) {
        steps = `• First 410,000: 25,000 UGX\n• Remaining ${format(taxableIncome - 410000)} @30%: UGX ${(0.3 * (taxableIncome - 410000)).toFixed(2)}`;
    } else if (taxableIncome > 335000) {
        steps = `• First 335,000: 10,000 UGX\n• Remaining ${format(taxableIncome - 335000)} @20%: UGX ${(0.2 * (taxableIncome - 335000)).toFixed(2)}`;
    } else if (taxableIncome > 235000) {
        steps = `• First 235,000: 0 UGX\n• Remaining ${format(taxableIncome - 235000)} @10%: UGX ${(0.1 * (taxableIncome - 235000)).toFixed(2)}`;
    }

    document.getElementById("payeCalculationSteps").textContent = steps;
}

// ====================== CHART UPDATES ======================
function updateChart(paye, nssf, others) {
    if (chart) chart.destroy();

    chart = new Chart(document.getElementById('deductionChart').getContext('2d'), {
        type: 'pie',
        data: {
            labels: ['PAYE', 'NSSF (Employee)', 'Other Deductions'],
            datasets: [{
                data: [paye, nssf, others],
                backgroundColor: ['#ff6384', '#36a2eb', '#ffcd56']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'Deduction Breakdown' }
            }
        }
    });
}


function downloadSummaryPDF() {
  const { jsPDF } = window.jspdf;

  const netPay = document.getElementById("netPay").textContent;
  const paye = document.getElementById("payeResult").textContent;
  const nssfEmployee = document.getElementById("nssfEmployee").textContent;
  const nssfEmployer = document.getElementById("nssfEmployer").textContent;
  const totalDeductions = document.getElementById("totalDeductions").textContent;
  const employerCost = document.getElementById("employerCost").textContent;
  const breakdown = document.getElementById("payeCalculationSteps").textContent;

  const doc = new jsPDF();

  let y = 10; // vertical starting point

  doc.setFontSize(16);
  doc.text("Uganda Net Pay Summary", 10, y);
  y += 10;
  doc.setFontSize(12);

  doc.text(`Net Pay: ${netPay} UGX`, 10, y);
  y += 7;
  doc.text(`PAYE: ${paye} UGX`, 10, y);
  y += 7;
  doc.text(`NSSF (Employee): ${nssfEmployee} UGX`, 10, y);
  y += 7;
  doc.text(`NSSF (Employer): ${nssfEmployer} UGX`, 10, y);
  y += 7;
  doc.text(`Total Deductions: ${totalDeductions} UGX`, 10, y);
  y += 7;
  doc.text(`Employer Total Cost: ${employerCost} UGX`, 10, y);
  y += 10;

  doc.text("PAYE Breakdown:", 10, y);
  y += 7;

  // Add breakdown text, split into lines to avoid overflow
  const splitText = doc.splitTextToSize(breakdown, 180);
  doc.text(splitText, 10, y);

  doc.save("net_pay_summary.pdf");
}


// ====================== HISTORY HANDLING ======================
function addToHistory() {
    const history = JSON.parse(localStorage.getItem('salaryHistory') || '[]');
    const entry = {
        timestamp: new Date().toISOString(),
        gross: document.getElementById('grossSalary').value,
        salaryType: document.getElementById('salaryType').value,
        paye: document.getElementById('payeResult').innerText,
        nssfEmp: document.getElementById('nssfEmployee').innerText,
        nssfEr: document.getElementById('nssfEmployer').innerText,
        netPay: document.getElementById('netPay').innerText,
        allowances: {
            housing: document.getElementById('housingAllowance').value,
            transport: document.getElementById('transportAllowance').value
        },
        deductions: document.getElementById('otherDeductions').value
    };

    if (history.length >= 10) history.shift();
    history.push(entry);
    localStorage.setItem('salaryHistory', JSON.stringify(history));
    displayHistory();
}

function displayHistory() {
    const history = JSON.parse(localStorage.getItem('salaryHistory') || '[]');
    const list = document.getElementById('historyList');
    list.innerHTML = '';

    history.reverse().forEach(entry => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div>
                <strong>${new Date(entry.timestamp).toLocaleString()}</strong>
                <div class="history-details">
                    Net Pay: UGX ${parseFloat(entry.netPay).toLocaleString('en-UG')} | 
                    Gross: UGX ${parseFloat(entry.gross).toLocaleString('en-UG')} (${entry.salaryType})
                </div>
            </div>
            <div>
                <button onclick="loadHistoryEntry('${entry.timestamp}')">View</button>
            </div>
        `;
        list.appendChild(li);
    });
}

function loadHistoryEntry(timestamp) {
    const history = JSON.parse(localStorage.getItem('salaryHistory') || '[]');
    const entry = history.find(e => e.timestamp === timestamp);
    if (!entry) return;

    document.getElementById('grossSalary').value = entry.gross;
    document.getElementById('salaryType').value = entry.salaryType;
    document.getElementById('housingAllowance').value = entry.allowances.housing;
    document.getElementById('transportAllowance').value = entry.allowances.transport;
    document.getElementById('otherDeductions').value = entry.deductions;
    calculateNetPay();
}

function clearHistory() {
    localStorage.removeItem('salaryHistory');
    displayHistory();
}

// ====================== FORM STATE ======================
function saveFormState() {
    const formData = {
        grossSalary: document.getElementById("grossSalary").value,
        nssfOption: document.getElementById("nssfOption").value,
        housingAllowance: document.getElementById("housingAllowance").value,
        transportAllowance: document.getElementById("transportAllowance").value,
        otherDeductions: document.getElementById("otherDeductions").value,
        salaryType: document.getElementById("salaryType").value
    };
    localStorage.setItem("salaryCalculatorData", JSON.stringify(formData));
}

function loadFormState() {
    const savedData = JSON.parse(localStorage.getItem("salaryCalculatorData"));
    if (!savedData) return;

    document.getElementById("grossSalary").value = savedData.grossSalary;
    document.getElementById("nssfOption").value = savedData.nssfOption;
    document.getElementById("housingAllowance").value = savedData.housingAllowance;
    document.getElementById("transportAllowance").value = savedData.transportAllowance;
    document.getElementById("otherDeductions").value = savedData.otherDeductions;
    document.getElementById("salaryType").value = savedData.salaryType || "monthly";
}

// ====================== UTILITIES ======================
function validateInput(input) {
    if (input.value < 0) {
        input.value = 0;
        showToast("Negative values not allowed!", "error");
    }
}

function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function updateDateTime() {
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    document.getElementById('dateTime').textContent = new Date().toLocaleString('en-GB', options);
}

// ====================== UI CONTROLS ======================
function resetForm() {
    document.getElementById("netPayForm").reset();
    document.querySelectorAll('[id$="Result"], #nssfEmployee, #nssfEmployer, #totalDeductions, #netPay')
        .forEach(el => el.innerText = "0");
    if (chart) chart.destroy();
}

function toggleDarkMode() {
    document.body.classList.toggle('dark');
}

function toggleHistory() {
    const content = document.getElementById('historyContent');
    content.classList.toggle('show');
    document.querySelector('.history-section h2').textContent = 
        content.classList.contains('show') ? '▼ Calculation History' : '▶ Calculation History';
}
