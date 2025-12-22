import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* FIREBASE */
const app = initializeApp({
  apiKey: "AIzaSyC9FgSPqQNLbIxa5hQ0mKWkABM-siTB-yY",
  authDomain: "easy-budgeting-93887.firebaseapp.com",
  projectId: "easy-budgeting-93887",
});
const auth = getAuth(app);
const db = getFirestore(app);

/* STATE */
function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

let selectedDate = getLocalDateString(); // uses device local date
let currentMonth = new Date(selectedDate);

let deleteId = null;

/* ELEMENTS */
const calendarGrid = document.querySelector(".calendar-grid");
const monthLabel = document.getElementById("monthLabel");
const currentDay = document.getElementById("currentDay");
const transactionsEl = document.getElementById("transactions");
currentDay.textContent = selectedDate;

const monthIncome = document.getElementById("monthIncome");
const monthExpense = document.getElementById("monthExpense");
const monthSaved = document.getElementById("monthSaved");

const incomeAmount = document.getElementById("incomeAmount");
const incomeLabel = document.getElementById("incomeLabel");
const expenseAmount = document.getElementById("expenseAmount");
const expenseLabel = document.getElementById("expenseLabel");

const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

/* AUTH */
document.getElementById("loginBtn").onclick = () =>
  signInWithPopup(auth, new GoogleAuthProvider());
document.getElementById("logoutBtn").onclick = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
  const loggedOut = document.getElementById("logged-out");
  const loggedIn = document.getElementById("logged-in");
  const appContainer = document.getElementById("app");
  const profilePic = document.getElementById("profilePic");

  if (user) {
    loggedOut.classList.add("d-none");
    loggedIn.classList.remove("d-none");
    appContainer.classList.remove("d-none");

    document.getElementById("userEmail").textContent = user.email;
    document.getElementById("profilePic").src = user.photoURL || "default.png";

    renderCalendar();
    loadTransactions();
  } else {
    loggedOut.classList.remove("d-none");
    loggedIn.classList.add("d-none");
    appContainer.classList.add("d-none");
  }
});

/* CALENDAR */
function renderCalendar() {
  calendarGrid.innerHTML = "";
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  monthLabel.textContent = currentMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) calendarGrid.innerHTML += `<div></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
      d,
    ).padStart(2, "0")}`;
    calendarGrid.innerHTML += `
      <div class="calendar-day ${dateStr === selectedDate ? "active" : ""}"
        onclick="selectDate('${dateStr}')">
        ${d}
      </div>
    `;
  }
}

window.selectDate = (date) => {
  selectedDate = date;
  currentDay.textContent = humanFriendlyDate(date);
  renderCalendar();
  loadTransactions();
};

document.getElementById("prevMonth").onclick = () => {
  currentMonth.setMonth(currentMonth.getMonth() - 1);
  renderCalendar();
};
document.getElementById("nextMonth").onclick = () => {
  currentMonth.setMonth(currentMonth.getMonth() + 1);
  renderCalendar();
};

/* DAY NAV */
document.getElementById("prevDay").onclick = () => changeDay(-1);
document.getElementById("nextDay").onclick = () => changeDay(1);

function changeDay(diff) {
  const d = new Date(selectedDate);
  d.setDate(d.getDate() + diff);
  selectedDate = getLocalDateString(d);
  currentDay.textContent = humanFriendlyDate(selectedDate);
  renderCalendar();
  loadTransactions();
}

/* HUMAN-FRIENDLY DATE */
function humanFriendlyDate(dateStr) {
  const today = getLocalDateString();
  const yesterday = getLocalDateString(new Date(Date.now() - 864e5));
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  return new Date(dateStr).toLocaleDateString();
}

/* ADD TRANSACTIONS */
document.getElementById("addIncome").onclick = () =>
  addTransaction("income", incomeAmount.value, incomeLabel.value);
document.getElementById("addExpense").onclick = () =>
  addTransaction("expense", expenseAmount.value, expenseLabel.value);

async function addTransaction(type, amount, label) {
  if (!amount || !label) return;
  await addDoc(
    collection(db, "budgets", auth.currentUser.uid, "transactions"),
    {
      type,
      amount: Number(amount),
      label,
      date: selectedDate,
    },
  );

  incomeAmount.value = "";
  incomeLabel.value = "";
  expenseAmount.value = "";
  expenseLabel.value = "";

  loadTransactions();
}

/* LOAD TRANSACTIONS */
async function loadTransactions() {
  const uid = auth.currentUser.uid;
  transactionsEl.innerHTML = "";

  let dayIncome = 0;
  let dayExpense = 0;

  let totalIncome = 0;
  let totalExpense = 0;

  let thisMonthIncome = 0;
  let thisMonthExpense = 0;
  let lastMonthIncome = 0;
  let lastMonthExpense = 0;

  const selectedMonthKey = selectedDate.slice(0, 7);

  const lastMonthDate = new Date(selectedMonthKey + "-01");
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonthKey = getLocalDateString(lastMonthDate).slice(0, 7);

  const snap = await getDocs(collection(db, "budgets", uid, "transactions"));

  const allTransactions = snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));

  const todaysTransactions = allTransactions.filter(
    (t) => t.date === selectedDate,
  );

  if (todaysTransactions.length === 0) {
    transactionsEl.innerHTML = `
      <p class="text-center text-muted">No transactions for this day.</p>
    `;
  }

  allTransactions.forEach((t) => {
    const monthKey = t.date.slice(0, 7);

    // ALL-TIME totals
    if (t.type === "income") totalIncome += t.amount;
    else totalExpense += t.amount;

    // MONTHLY totals
    if (monthKey === selectedMonthKey) {
      if (t.type === "income") thisMonthIncome += t.amount;
      else thisMonthExpense += t.amount;
    }

    if (monthKey === lastMonthKey) {
      if (t.type === "income") lastMonthIncome += t.amount;
      else lastMonthExpense += t.amount;
    }

    // DAILY totals + render
    if (t.date !== selectedDate) return;

    if (t.type === "income") dayIncome += t.amount;
    else dayExpense += t.amount;

    transactionsEl.innerHTML += `
      <div class="card mb-1">
        <div class="card-body d-flex justify-content-between align-items-center">
          <span>${t.label}</span>
          <div>
            <strong class="${
              t.type === "income" ? "text-success" : "text-danger"
            }">
              ${t.type === "income" ? "+" : "-"} Rp ${t.amount.toLocaleString(
                "id-ID",
              )}
            </strong>
            <button
              onclick="showDeleteModal('${t.id}')"
              class="btn btn-sm btn-outline-danger ms-2"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    `;
  });

  // DAY SUMMARY
  monthIncome.textContent = dayIncome.toLocaleString("id-ID");
  monthExpense.textContent = dayExpense.toLocaleString("id-ID");
  monthSaved.textContent = (dayIncome - dayExpense).toLocaleString("id-ID");

  // SAVINGS
  updateSavings(totalIncome, totalExpense);

  // MONTH COMPARISON
  updateMonthComparison(
    thisMonthIncome,
    thisMonthExpense,
    lastMonthIncome,
    lastMonthExpense,
  );
}

/* UPDATE SAVINGS */
async function updateSavings(income, expense) {
  const metaSnap = await getDoc(
    doc(db, "budgets", auth.currentUser.uid, "meta", "data"),
  );
  const total = (metaSnap.data()?.startSavings || 0) + income - expense;
  document.getElementById("savings").textContent =
    "Rp " + total.toLocaleString("id-ID");
}

function updateMonthComparison(
  thisIncome,
  thisExpense,
  lastIncome,
  lastExpense,
) {
  const el = document.getElementById("monthCompareText");

  const thisSaved = thisIncome - thisExpense;
  const lastSaved = lastIncome - lastExpense;
  const diff = thisSaved - lastSaved;

  if (lastIncome === 0 && lastExpense === 0) {
    el.textContent = "No data for last month yet";
    el.className = "text-muted";
    return;
  }

  if (diff > 0) {
    el.textContent = `🎉 You saved Rp ${diff.toLocaleString(
      "id-ID",
    )} MORE than last month`;
    el.className = "text-success";
  } else if (diff < 0) {
    el.textContent = `⚠️ You saved Rp ${Math.abs(diff).toLocaleString(
      "id-ID",
    )} LESS than last month`;
    el.className = "text-danger";
  } else {
    el.textContent = "➖ You saved the same as last month";
    el.className = "text-muted";
  }
}

/* DELETE MODAL */
window.showDeleteModal = (id) => {
  deleteId = id;
  const modalEl = document.getElementById("deleteModal");
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
};

confirmDeleteBtn.onclick = async () => {
  if (!deleteId) return;
  const uid = auth.currentUser.uid;
  await deleteDoc(doc(db, "budgets", uid, "transactions", deleteId));
  deleteId = null;
  loadTransactions();
  const modalEl = document.getElementById("deleteModal");
  bootstrap.Modal.getInstance(modalEl).hide();
};
