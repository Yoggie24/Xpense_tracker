// ============================================================
// charts.js — Chart.js rendering (daily trend + pie charts)
// ============================================================

let dailyChartInstance = null;
let incomePieChartInstance = null;
let outcomePieChartInstance = null;
let TREND_RANGE = 7; // Default chart range (7 days)

// Group outcomes for Chart.js
function groupOutcomesByDate(days = 7) {
    const transactions = getTransactions();
    const labels = [];
    const data = [];

    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];

        const dayTotal = transactions
            .filter(t => t.type === 'expense' && t.date.split('T')[0] === dateStr)
            .reduce((sum, t) => sum + t.amount, 0);

        // Format label: short weekday for 7D, numeric for 30D
        const labelText = days <= 7
            ? d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' })
            : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

        labels.push(labelText);
        data.push(dayTotal);
    }

    return { labels, data };
}

// Update Trend Range
function updateTrendRange(days) {
    TREND_RANGE = days;

    // Update UI buttons
    document.querySelectorAll('.trend-range-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.days) === days);
    });

    renderDailyChart();
}

// Render Daily Trend Chart
function renderDailyChart() {
    const canvas = document.getElementById('dailyChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const chartData = groupOutcomesByDate(TREND_RANGE);

    if (dailyChartInstance) {
        dailyChartInstance.destroy();
    }

    dailyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [{
                label: 'Outcome Trend',
                data: chartData.data,
                borderColor: '#0060af',
                backgroundColor: 'rgba(0, 96, 175, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: TREND_RANGE > 7 ? 4 : 6,
                pointBackgroundColor: '#0060af',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: (v) => formatMoney(v) }
                },
                x: {
                    ticks: {
                        autoSkip: true,
                        maxRotation: 0,
                        font: { size: 10 }
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (c) => ` Outcome: ${formatMoney(c.raw)}`
                    }
                }
            }
        }
    });
}

// Aggregate monthly category data
function aggregateMonthlyCategories() {
    const transactions = getTransactions();
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const incomeData = {};
    const outcomeData = {};

    transactions.forEach(t => {
        const transDate = new Date(t.date);
        if (transDate >= startOfMonth) {
            const cat = t.category || 'Other';
            if (t.type === 'income') {
                incomeData[cat] = (incomeData[cat] || 0) + t.amount;
            } else {
                outcomeData[cat] = (outcomeData[cat] || 0) + t.amount;
            }
        }
    });

    return {
        income: {
            labels: Object.keys(incomeData),
            values: Object.values(incomeData)
        },
        outcome: {
            labels: Object.keys(outcomeData),
            values: Object.values(outcomeData)
        }
    };
}

// Render Monthly Pie Charts
function renderPieCharts() {
    const data = aggregateMonthlyCategories();
    // A palette of vibrant, harmonious colors for the pie charts
    const colors = [
        '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b',
        '#858796', '#5a5c69', '#6610f2', '#6f42c1', '#e83e8c'
    ];

    // Income Pie Chart
    const incomeCanvas = document.getElementById('incomePieChart');
    if (incomeCanvas) {
        if (incomePieChartInstance) incomePieChartInstance.destroy();
        if (data.income.labels.length > 0) {
            const total = data.income.values.reduce((a, b) => a + b, 0);
            incomePieChartInstance = new Chart(incomeCanvas, {
                type: 'doughnut',
                data: {
                    labels: data.income.labels,
                    datasets: [{
                        data: data.income.values,
                        backgroundColor: colors,
                        hoverOffset: 12,
                        borderWidth: 2,
                        borderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '65%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                boxWidth: 12,
                                padding: 15,
                                font: { size: 11, family: "'Inter', sans-serif", weight: '500' }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const value = context.raw;
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return ` ${context.label}: ${formatMoney(value)} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        } else {
            const ctx = incomeCanvas.getContext('2d');
            ctx.clearRect(0, 0, incomeCanvas.width, incomeCanvas.height);
            ctx.font = '14px sans-serif';
            ctx.fillStyle = '#6b7280';
            ctx.textAlign = 'center';
            ctx.fillText('No Income data', incomeCanvas.width / 2, incomeCanvas.height / 2);
        }
    }

    // Outcome Pie Chart
    const outcomeCanvas = document.getElementById('outcomePieChart');
    if (outcomeCanvas) {
        if (outcomePieChartInstance) outcomePieChartInstance.destroy();
        if (data.outcome.labels.length > 0) {
            const total = data.outcome.values.reduce((a, b) => a + b, 0);
            outcomePieChartInstance = new Chart(outcomeCanvas, {
                type: 'doughnut',
                data: {
                    labels: data.outcome.labels,
                    datasets: [{
                        data: data.outcome.values,
                        backgroundColor: colors,
                        hoverOffset: 12,
                        borderWidth: 2,
                        borderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '65%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                boxWidth: 12,
                                padding: 15,
                                font: { size: 11, family: "'Inter', sans-serif", weight: '500' }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: (context) => {
                                    const value = context.raw;
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return ` ${context.label}: ${formatMoney(value)} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        } else {
            const ctx = outcomeCanvas.getContext('2d');
            ctx.clearRect(0, 0, outcomeCanvas.width, outcomeCanvas.height);
            ctx.font = '14px sans-serif';
            ctx.fillStyle = '#6b7280';
            ctx.textAlign = 'center';
            ctx.fillText('No Outcome data', outcomeCanvas.width / 2, outcomeCanvas.height / 2);
        }
    }
}
